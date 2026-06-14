import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { ConnectionStatus } from './ConnectionStatus';
import { ProgressBar } from './ProgressBar';
import { DisconnectAlert } from './DisconnectAlert';
import { DownloadCloud, AlertCircle, Home } from 'lucide-react';
import { importKeyFromBase64 } from '../utils/crypto';

export function ReceiverRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  
  const [cryptoKey, setCryptoKey] = useState(null);
  const [error, setError] = useState('');

  const { receiverProgress, fileName, onMessage } = useFileTransfer(cryptoKey, socket, roomId);
  const { connectionState } = useWebRTC(socket, roomId, onMessage);
  
  const hasJoined = useRef(false);

  useEffect(() => {
    async function initKey() {
      try {
        const hash = location.hash;
        if (hash.startsWith('#key=')) {
          const base64 = hash.slice(5);
          const key = await importKeyFromBase64(base64);
          setCryptoKey(key);
        } else {
          setError('Missing encryption key in URL.');
        }
      } catch (err) {
        setError('Invalid encryption key.');
      }
    }
    initKey();
  }, [location.hash]);

  const handleGoHome = () => {
    navigate('/');
  };

  useEffect(() => {
    if (!socket || !roomId || hasJoined.current) return;
    
    hasJoined.current = true;
    const lastIndex = localStorage.getItem(`resume-${roomId}`);
    if (lastIndex) {
      socket.emit('resume-from', { roomId, fromChunk: parseInt(lastIndex, 10) });
    } else {
      socket.emit('join-room', { roomId });
    }
    
    socket.on('room-error', ({ message }) => {
      setError(message);
    });

    return () => {
      hasJoined.current = false;
      socket.off('room-error');
      socket.emit('leave-room', { roomId });
    };
  }, [socket, roomId]);



  if (error) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-h)] mb-2">Room Error</h2>
        <p className="text-black">{error}</p>
        <button onClick={handleGoHome} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90">
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-white border border-[var(--border)] rounded-2xl shadow-[var(--shadow)]">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleGoHome} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-black"
            title="Leave Room"
          >
            <Home className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-[var(--text-h)]">Receiving File</h2>
        </div>
        <ConnectionStatus state={connectionState} />
      </div>

      {connectionState === 'waiting' && (
        <div className="py-12 flex flex-col items-center justify-center text-black">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)] mb-4"></div>
          <p>Connecting to sender...</p>
        </div>
      )}

      {connectionState === 'connected' && receiverProgress.status === 'waiting' && (
        <div className="py-12 flex flex-col items-center justify-center text-black">
          <DownloadCloud className="w-12 h-12 mb-4 opacity-50" />
          <p>Connected. Waiting for file...</p>
        </div>
      )}

      {fileName && (
        <div className="mb-6 p-4 border border-gray-100 rounded-xl">
          <p className="font-medium text-[var(--text-h)] truncate">Incoming: {fileName}</p>
        </div>
      )}

      {(receiverProgress.status === 'receiving' || receiverProgress.status === 'verifying') && (
        <ProgressBar 
          percent={receiverProgress.percent} 
          speedMBps={receiverProgress.speedMBps} 
          label={receiverProgress.status === 'verifying' ? 'Verifying Integrity...' : 'Receiving...'} 
        />
      )}

      {receiverProgress.status === 'done' && (
        <div className="mt-6 p-6 bg-green-50 text-green-700 rounded-xl border border-green-200 text-center">
          <h3 className="font-bold text-lg mb-2">Download Complete!</h3>
          <p className="text-sm opacity-90">{fileName} has been saved to your device.</p>
        </div>
      )}

      {receiverProgress.status === 'error' && (
        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-bold">File integrity check failed.</p>
          <p className="text-sm">The received file may be corrupted. Please retry.</p>
        </div>
      )}

      {connectionState === 'disconnected' && receiverProgress.status !== 'done' && (
        <DisconnectAlert />
      )}
    </div>
  );
}
