import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { ConnectionStatus } from './ConnectionStatus';
import { ProgressBar } from './ProgressBar';
import { DisconnectAlert } from './DisconnectAlert';
import { Copy, CheckCircle2, Home } from 'lucide-react';
import { generateKey, exportKeyToBase64 } from '../utils/crypto';

export function ShareRoom() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const file = location.state?.file;

  const [copied, setCopied] = useState(false);
  const [isReadyToStart, setIsReadyToStart] = useState(false);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [base64Key, setBase64Key] = useState('');
  
  const socket = useSocket();
  const { sendFile, transferProgress, receiverProgress, fileName, onMessage, resumeFrom, pauseTransfer } = useFileTransfer(cryptoKey, socket, roomId);
  const { connectionState, dataChannel } = useWebRTC(socket, roomId, onMessage);

  useEffect(() => {
    if (socket && roomId) {
      socket.emit('create-room', { roomId });

      return () => {
        socket.emit('leave-room', { roomId });
      };
    }
  }, [socket, roomId]);

  useEffect(() => {
    async function initKey() {
      const key = await generateKey();
      const b64 = await exportKeyToBase64(key);
      setCryptoKey(key);
      setBase64Key(b64);
    }
    initKey();
  }, []);

  const inviteUrl = base64Key ? `${window.location.origin}/room/${roomId}#key=${base64Key}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  useEffect(() => {
    if (connectionState === 'disconnected' && transferProgress.status === 'sending') {
      pauseTransfer();
    }
  }, [connectionState, transferProgress.status, pauseTransfer]);

  useEffect(() => {
    if (connectionState === 'connected' && dataChannel && file && (transferProgress.status === 'idle' || transferProgress.status === 'paused')) {
      if (dataChannel.readyState === 'open') {
        setIsReadyToStart(true);
      } else {
        dataChannel.onopen = () => setIsReadyToStart(true);
      }
    } else {
      setIsReadyToStart(false);
    }
  }, [connectionState, dataChannel, file, transferProgress.status]);

  const handleStartTransfer = () => {
    if (dataChannel && dataChannel.readyState === 'open' && cryptoKey) {
      sendFile(file, dataChannel, cryptoKey);
      setIsReadyToStart(false);
    }
  };

  useEffect(() => {
    if (isReadyToStart && transferProgress.status === 'paused' && resumeFrom > 0) {
      handleStartTransfer();
    }
  }, [isReadyToStart, transferProgress.status, resumeFrom]);

  if (!file) {
    return <div className="p-8 text-center text-red-500">Error: No file selected.</div>;
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
          <h2 className="text-xl font-bold text-[var(--text-h)]">Sending File</h2>
        </div>
        <ConnectionStatus state={connectionState} />
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
        <p className="text-sm text-black font-medium mb-2">Share this link with the receiver:</p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--text-h)] focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="p-2 bg-gray-200 text-black rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
            title="Copy Link"
          >
            {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 border border-gray-100 rounded-xl">
        <p className="font-medium text-[var(--text-h)] truncate">{file.name}</p>
        <p className="text-sm text-black">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>

      {isReadyToStart && transferProgress.status === 'idle' && (
        <button 
          onClick={handleStartTransfer}
          className="w-full mb-6 bg-blue-600 text-white font-medium py-3 rounded-xl hover:opacity-90 transition-all shadow-sm"
        >
          Start Transfer
        </button>
      )}

      {connectionState === 'connected' && transferProgress.status !== 'idle' && transferProgress.status !== 'done' && (
        <ProgressBar
          percent={transferProgress.percent}
          speedMBps={transferProgress.speedMBps}
          label={transferProgress.status === 'hashing' ? 'Hashing...' : 'Sending...'}
        />
      )}

      {transferProgress.status === 'done' && (
        <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Transfer Complete</span>
        </div>
      )}

      {connectionState === 'disconnected' && <DisconnectAlert />}
    </div>
  );
}
