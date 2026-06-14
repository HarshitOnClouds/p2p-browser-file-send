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

  // Initialize RTCPeerConnection
  useEffect(() => {
    if (!socket || !roomId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    // Connection state tracking
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    // Receiver: Capture incoming data channel
    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.binaryType = 'arraybuffer';
      receiveChannel.onmessage = onMessage;
      setDataChannel(receiveChannel);
    };

    // Socket Event Handlers
    const handlePeerJoined = async () => {
      await createOffer();
    };

    const iceCandidateQueue = [];

    const handleOffer = async ({ sdp }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, sdp: answer });
      // Process queued candidates
      iceCandidateQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
      iceCandidateQueue.length = 0;
    };

    const handleAnswer = async ({ sdp }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      // Process queued candidates
      iceCandidateQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
      iceCandidateQueue.length = 0;
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (candidate) {
        if (!pc.remoteDescription) {
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

    // Register socket events
    socket.on('peer-joined', handlePeerJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('peer-disconnected', handlePeerDisconnected);

    return () => {
      // Cleanup on unmount
      socket.off('peer-joined', handlePeerJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('peer-disconnected', handlePeerDisconnected);
      closeConnection();
      socket.emit('leave-room');
    };
  }, [socket, roomId, onMessage]);

  // Sender function: Create offer and data channel
  const createOffer = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    // Always create with { ordered: true } to guarantee chunk arrival sequence
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    
    // We attach onmessage for any return messages (if needed)
    dc.onmessage = onMessage;
    setDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { roomId, sdp: offer });
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
