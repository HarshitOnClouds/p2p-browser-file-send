import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { ConnectionStatus } from './ConnectionStatus';
import { ProgressBar } from './ProgressBar';
import { DisconnectAlert } from './DisconnectAlert';
import { DownloadCloud, AlertCircle, Home } from 'lucide-react';

export function ReceiverRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { receiverProgress, fileName, onMessage } = useFileTransfer();
  const { connectionState } = useWebRTC(socket, roomId, onMessage);
  
  const [error, setError] = useState('');

  const hasJoined = useRef(false);

  const handleGoHome = () => {
    navigate('/');
  };

  useEffect(() => {
    if (!socket || !roomId || hasJoined.current) return;
    
    hasJoined.current = true;
    socket.emit('join-room', { roomId });
    
    socket.on('room-error', ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off('room-error');
    };
  }, [socket, roomId]);

  // Trigger file download when complete
  useEffect(() => {
    if (receiverProgress.status === 'done' && receiverProgress.url) {
      const a = document.createElement('a');
      a.href = receiverProgress.url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [receiverProgress.status, receiverProgress.url, fileName]);

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-h)] mb-2">Room Error</h2>
        <p className="text-gray-600">{error}</p>
        <button onClick={handleGoHome} className="mt-6 px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90">
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
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            title="Leave Room"
          >
            <Home className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-[var(--text-h)]">Receiving File</h2>
        </div>
        <ConnectionStatus state={connectionState} />
      </div>

      {connectionState === 'waiting' && (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)] mb-4"></div>
          <p>Connecting to sender...</p>
        </div>
      )}

      {connectionState === 'connected' && receiverProgress.status === 'waiting' && (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
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
