import { useState, useEffect, useRef } from 'react';

/**
 * Core WebRTC Hook managing the peer connection and data channel.
 * 
 * @param {Object} socket - The socket instance for signaling.
 * @param {string} roomId - The current room ID.
 * @param {Function} onMessage - Callback for when data channel receives a message.
 * @returns {Object} { connectionState, dataChannel, peerConnection, createOffer, closeConnection }
 */
export function useWebRTC(socket, roomId, onMessage) {
  const [connectionState, setConnectionState] = useState('new');
  const [dataChannel, setDataChannel] = useState(null);
  
  const pcRef = useRef(null);
  const sessionIdRef = useRef(null);
  const remoteSessionIdRef = useRef(null);
  
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const initializePC = () => {
      if (pcRef.current) return pcRef.current;
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;
      sessionIdRef.current = Math.random().toString(36).substring(2, 10);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { 
            roomId, 
            candidate: event.candidate,
            senderSessionId: sessionIdRef.current,
            targetSessionId: remoteSessionIdRef.current
          });
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
      };

      pc.ondatachannel = (event) => {
        const receiveChannel = event.channel;
        receiveChannel.binaryType = 'arraybuffer';
        receiveChannel.onmessage = (e) => {
          if (onMessageRef.current) onMessageRef.current(e);
        };
        setDataChannel(receiveChannel);
      };
      
      return pc;
    };

    initializePC();

    const handlePeerJoined = async () => {
      if (pcRef.current) {
        // If the receiver is joining fresh (e.g. remounting or reloading), 
        // we MUST reset our peer connection to generate fresh ICE candidates.
        closeConnection();
      }
      initializePC();
      await createOffer();
    };

    const iceCandidateQueue = [];

    const handleOffer = async ({ sdp, senderSessionId }) => {
      remoteSessionIdRef.current = senderSessionId;
      const pc = pcRef.current || initializePC();
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { 
        roomId, 
        sdp: answer,
        targetSessionId: senderSessionId
      });
      iceCandidateQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
      iceCandidateQueue.length = 0;
    };

    const handleAnswer = async ({ sdp, targetSessionId }) => {
      if (targetSessionId !== sessionIdRef.current) return;
      const pc = pcRef.current;
      if (!pc || pc.signalingState === 'stable') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Failed to set remote description:", err);
        return;
      }
      iceCandidateQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
      iceCandidateQueue.length = 0;
    };

    const handleIceCandidate = async ({ candidate, targetSessionId, senderSessionId }) => {
      if (targetSessionId && targetSessionId !== sessionIdRef.current) return;
      
      const pc = pcRef.current;
      if (candidate) {
        if (!pc || !pc.remoteDescription) {
          iceCandidateQueue.push(candidate);
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        }
      }
    };

    const handlePeerDisconnected = () => {
      closeConnection();
      setConnectionState('disconnected');
    };

    socket.on('peer-joined', handlePeerJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('peer-disconnected', handlePeerDisconnected);

    return () => {
      socket.off('peer-joined', handlePeerJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('peer-disconnected', handlePeerDisconnected);
      closeConnection();
      socket.emit('leave-room', { roomId });
    };
  }, [socket, roomId]);

  const createOffer = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    
    dc.onmessage = (e) => {
      if (onMessageRef.current) onMessageRef.current(e);
    };
    setDataChannel(dc);

    const offer = await pc.createOffer();
    
    if (pcRef.current !== pc) return;

    await pc.setLocalDescription(offer);
    socket.emit('offer', { 
      roomId, 
      sdp: offer,
      senderSessionId: sessionIdRef.current 
    });
  };

  const closeConnection = () => {
    if (dataChannel) {
      dataChannel.close();
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setDataChannel(null);
  };

  return {
    connectionState,
    dataChannel,
    peerConnection: pcRef.current,
    createOffer,
    closeConnection
  };
}
