import { useState, useCallback, useRef } from 'react';
import { sha256 } from '../utils/crypto';
import { CHUNK_SIZE } from '../utils/chunker';

/**
 * Hook to manage the file transfer logic over WebRTC DataChannels.
 * 
 * @returns {Object} { sendFile, transferProgress, receiverProgress, fileName, receiverStatus, onMessage }
 */
export function useFileTransfer() {
  const [transferProgress, setTransferProgress] = useState({ percent: 0, speedMBps: 0, status: 'idle' });
  const [receiverProgress, setReceiverProgress] = useState({ percent: 0, speedMBps: 0, status: 'waiting' });
  const [fileName, setFileName] = useState('');
  
  // Receiver state refs
  const receivedChunksRef = useRef([]);
  const expectedMetaRef = useRef(null);
  const receivedBytesRef = useRef(0);
  const startTimeRef = useRef(0);

  /**
   * Sender: Reads the file, hashes it, and sends chunks over the data channel.
   * @param {File} file 
   * @param {RTCDataChannel} dataChannel 
   */
  const sendFile = useCallback(async (file, dataChannel) => {
    if (!dataChannel || dataChannel.readyState !== 'open') return;
    
    setTransferProgress({ percent: 0, speedMBps: 0, status: 'hashing' });
    
    const arrayBuffer = await file.arrayBuffer();
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
    let offset = 0;
    let chunkIndex = 0;

    // Helper to wait until buffer is low (polling is much more robust than the flaky bufferedamountlow event)
    const waitForBuffer = async () => {
      while (dataChannel.bufferedAmount > 1024 * 1024) { // 1MB threshold
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };

    while (offset < arrayBuffer.byteLength) {
      await waitForBuffer();
      
      // Using .slice is safer for browser WebRTC bindings than Uint8Array views, 
      // as it strictly allocates an exact 64KB ArrayBuffer and avoids holding a reference to the entire 40MB file.
      const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      dataChannel.send(chunk);
      
      offset += chunk.byteLength;
      chunkIndex++;

      // Yield the event loop every 10 chunks to prevent freezing the browser UI
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

    // Send done signal
    dataChannel.send(JSON.stringify({ type: 'done' }));
    setTransferProgress(prev => ({ ...prev, status: 'done' }));

  }, []);

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
      } 
      else if (data.type === 'done') {
        setReceiverProgress(prev => ({ ...prev, status: 'verifying' }));
        
        const meta = expectedMetaRef.current;
        
        // Reassemble chunks
        const fullBuffer = new Uint8Array(meta.size);
        let offset = 0;
        for (const chunk of receivedChunksRef.current) {
          fullBuffer.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }

        // Verify hash
        const computedHash = await sha256(fullBuffer.buffer);
        
        if (computedHash === meta.sha256) {
          setReceiverProgress(prev => ({ ...prev, status: 'done' }));
          // Trigger download
          const blob = new Blob([fullBuffer.buffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
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
      // It's a file chunk
      receivedChunksRef.current.push(event.data);
      receivedBytesRef.current += event.data.byteLength;
      
      const meta = expectedMetaRef.current;
      if (meta) {
        const elapsedSec = (performance.now() - startTimeRef.current) / 1000;
        const speedMBps = elapsedSec > 0 ? (receivedBytesRef.current / 1024 / 1024) / elapsedSec : 0;
        const percent = Math.round((receivedChunksRef.current.length / meta.totalChunks) * 100);
        
        setReceiverProgress({
          percent,
          speedMBps: parseFloat(speedMBps.toFixed(2)),
          status: 'receiving'
        });
      }
    }
  }, []);

  return {
    sendFile,
    transferProgress,
    receiverProgress,
    fileName,
    onMessage
  };
}
