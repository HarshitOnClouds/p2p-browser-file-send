import { useState, useCallback, useRef, useEffect } from 'react';
import { sha256, encryptChunk, decryptChunk } from '../utils/crypto';
import { CHUNK_SIZE } from '../utils/chunker';

/**
 * Hook to manage the file transfer logic over WebRTC DataChannels.
 * 
 * @param {CryptoKey} [cryptoKey] - Optional AES-GCM key for encryption/decryption.
 * @returns {Object} { sendFile, transferProgress, receiverProgress, fileName, receiverStatus, onMessage }
 */
export function useFileTransfer(cryptoKey = null, socket = null, roomId = null) {
  const [transferProgress, setTransferProgress] = useState({ percent: 0, speedMBps: 0, status: 'idle' });
  const [receiverProgress, setReceiverProgress] = useState({ percent: 0, speedMBps: 0, status: 'waiting' });
  const [fileName, setFileName] = useState('');
  const [resumeFrom, setResumeFrom] = useState(0);
  const resumeFromRef = useRef(0);
  
  const cryptoKeyRef = useRef(cryptoKey);
  useEffect(() => {
    cryptoKeyRef.current = cryptoKey;
  }, [cryptoKey]);

  useEffect(() => {
    if (!socket) return;
    const handleResume = ({ fromChunk }) => {
      console.log(`Resuming transfer from chunk ${fromChunk}`);
      resumeFromRef.current = fromChunk;
      setResumeFrom(fromChunk);
    };
    socket.on('resume-transfer', handleResume);
    return () => socket.off('resume-transfer', handleResume);
  }, [socket]);

  // Receiver state refs
  const receivedChunksRef = useRef([]);
  const receivedChunksSetRef = useRef(new Set());
  const expectedMetaRef = useRef(null);
  const receivedBytesRef = useRef(0);
  const startTimeRef = useRef(0);

  /**
   * Sender: Reads the file, hashes it, and sends chunks over the data channel.
   * @param {File} file 
   * @param {RTCDataChannel} dataChannel 
   * @param {CryptoKey} [senderKey] - Optional key for sender encryption
   */
  const sendFile = useCallback(async (file, dataChannel, senderKey = null) => {
    if (!dataChannel || dataChannel.readyState !== 'open') return;
    
    setTransferProgress({ percent: 0, speedMBps: 0, status: 'hashing' });
    
    const arrayBuffer = await file.arrayBuffer();
    // SHA-256 on plaintext
    const fullHash = await sha256(arrayBuffer);
    
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Send meta info
    dataChannel.send(JSON.stringify({
      type: 'meta',
      name: file.name,
      size: file.size,
      totalChunks,
      sha256: fullHash
    }));

    setTransferProgress({ percent: 0, speedMBps: 0, status: 'sending' });
    const startTime = performance.now();
    let chunkIndex = resumeFromRef.current;
    let offset = chunkIndex * CHUNK_SIZE;

    const waitForBuffer = async () => {
      while (dataChannel.bufferedAmount > 1024 * 1024) { 
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };

    while (offset < arrayBuffer.byteLength) {
      await waitForBuffer();
      
      let chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      const originalLength = chunk.byteLength;
      
      // Encrypt if key is provided
      if (senderKey) {
        chunk = await encryptChunk(senderKey, chunk);
      }
      
      // Prepend 4-byte chunk index for auto-resume
      const payload = new ArrayBuffer(4 + chunk.byteLength);
      const view = new DataView(payload);
      view.setUint32(0, chunkIndex, true); // little-endian
      new Uint8Array(payload).set(new Uint8Array(chunk), 4);
      
      try {
        dataChannel.send(payload);
      } catch (err) {
        console.warn("Transfer interrupted. Data channel closed.");
        break;
      }
      
      offset += originalLength;
      chunkIndex++;

      if (chunkIndex % 10 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }

      const elapsedSec = (performance.now() - startTime) / 1000;
      const speedMBps = elapsedSec > 0 ? (offset / 1024 / 1024) / elapsedSec : 0;
      const percent = Math.round((chunkIndex / totalChunks) * 100);

      setTransferProgress({
        percent,
        speedMBps: parseFloat(speedMBps.toFixed(2)),
        status: 'sending'
      });
    }

    dataChannel.send(JSON.stringify({ type: 'done' }));
    setTransferProgress(prev => ({ ...prev, status: 'done' }));

  }, []);

  const opfsHandleRef = useRef(null);
  const opfsWritableRef = useRef(null);

  /**
   * Receiver: Handles incoming messages on the data channel.
   */
  const onMessage = useCallback(async (event) => {
    if (typeof event.data === 'string') {
      const data = JSON.parse(event.data);
      
      if (data.type === 'meta') {
        expectedMetaRef.current = data;
        setFileName(data.name);
        receivedChunksRef.current = [];
        receivedBytesRef.current = 0;
        startTimeRef.current = performance.now();
        setReceiverProgress({ percent: 0, speedMBps: 0, status: 'receiving' });

        // Try to initialize OPFS
        if ('storage' in navigator && 'getDirectory' in navigator.storage) {
          try {
            const root = await navigator.storage.getDirectory();
            const lastIndex = localStorage.getItem(`resume-${roomId}`);
            const isResuming = !!lastIndex;
            
            const handle = await root.getFileHandle(data.name, { create: true });
            const writable = await handle.createWritable({ keepExistingData: isResuming });
            
            if (isResuming) {
               const resumeIdx = parseInt(lastIndex, 10);
               for (let i = 0; i < resumeIdx; i++) {
                 receivedChunksSetRef.current.add(i);
               }
               receivedBytesRef.current = resumeIdx * CHUNK_SIZE;
            }
            
            opfsHandleRef.current = handle;
            opfsWritableRef.current = writable;
          } catch (e) {
            console.warn("Failed to initialize OPFS, falling back to RAM", e);
            opfsHandleRef.current = null;
            opfsWritableRef.current = null;
          }
        }
      } 
      else if (data.type === 'done') {
        localStorage.removeItem(`resume-${roomId}`);
        setReceiverProgress(prev => ({ ...prev, status: 'verifying' }));
        
        const meta = expectedMetaRef.current;
        let finalBuffer;

        if (opfsWritableRef.current) {
          await opfsWritableRef.current.close();
          const file = await opfsHandleRef.current.getFile();
          finalBuffer = await file.arrayBuffer();
        } else {
          // Fallback RAM Reassembly using absolute positions
          const fullBuffer = new Uint8Array(meta.size);
          for (let i = 0; i < receivedChunksRef.current.length; i++) {
            const chunk = receivedChunksRef.current[i];
            if (chunk) {
              fullBuffer.set(new Uint8Array(chunk), i * CHUNK_SIZE);
            }
          }
          finalBuffer = fullBuffer.buffer;
        }

        // Verify hash on plaintext
        const computedHash = await sha256(finalBuffer);
        
        if (computedHash === meta.sha256) {
          setReceiverProgress(prev => ({ ...prev, status: 'done' }));
          
          let url;
          if (opfsWritableRef.current) {
            const file = await opfsHandleRef.current.getFile();
            url = URL.createObjectURL(file);
            // Clean up OPFS file after download trigger is initiated
            setTimeout(async () => {
              try {
                const root = await navigator.storage.getDirectory();
                await root.removeEntry(meta.name);
              } catch (e) {
                console.warn("Could not delete OPFS file", e);
              }
            }, 5000);
          } else {
            const blob = new Blob([finalBuffer], { type: 'application/octet-stream' });
            url = URL.createObjectURL(blob);
          }

          const a = document.createElement('a');
          a.href = url;
          a.download = meta.name;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          setReceiverProgress(prev => ({ ...prev, status: 'error' }));
          console.error("File integrity check failed");
        }
      }
    } else if (event.data instanceof ArrayBuffer) {
      const view = new DataView(event.data);
      const chunkIndex = view.getUint32(0, true);
      let chunkData = event.data.slice(4);
      
      // Decrypt if key is available
      if (cryptoKeyRef.current) {
        try {
          chunkData = await decryptChunk(cryptoKeyRef.current, chunkData);
        } catch (err) {
          console.error("Decryption failed:", err);
          return;
        }
      }

      if (opfsWritableRef.current) {
        await opfsWritableRef.current.write({
          type: 'write',
          position: chunkIndex * CHUNK_SIZE,
          data: chunkData
        });
        if (roomId) {
          localStorage.setItem(`resume-${roomId}`, (chunkIndex + 1).toString());
        }
      } else {
        receivedChunksRef.current[chunkIndex] = chunkData;
      }
      
      if (!receivedChunksSetRef.current.has(chunkIndex)) {
        receivedChunksSetRef.current.add(chunkIndex);
        receivedBytesRef.current += chunkData.byteLength;
      }
      
      const meta = expectedMetaRef.current;
      if (meta) {
        const elapsedSec = (performance.now() - startTimeRef.current) / 1000;
        const speedMBps = elapsedSec > 0 ? (receivedBytesRef.current / 1024 / 1024) / elapsedSec : 0;
        const percent = Math.round((receivedBytesRef.current / meta.size) * 100);
        
        setReceiverProgress({
          percent,
          speedMBps: parseFloat(speedMBps.toFixed(2)),
          status: 'receiving'
        });
      }
    }
  }, []);

  const pauseTransfer = useCallback(() => {
    setTransferProgress(prev => prev.status === 'sending' ? { ...prev, status: 'paused' } : prev);
  }, []);

  return {
    sendFile,
    transferProgress,
    receiverProgress,
    fileName,
    onMessage,
    resumeFrom,
    pauseTransfer
  };
}
