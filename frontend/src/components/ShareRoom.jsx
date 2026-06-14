import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { ConnectionStatus } from './ConnectionStatus';
import { ProgressBar } from './ProgressBar';
import { DisconnectAlert } from './DisconnectAlert';
import { Copy, CheckCircle2, Home } from 'lucide-react';

export function ShareRoom() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const file = location.state?.file;

  const [copied, setCopied] = useState(false);
  const [isReadyToStart, setIsReadyToStart] = useState(false);
  const socket = useSocket();
  const { sendFile, transferProgress, onMessage } = useFileTransfer();
  const { connectionState, dataChannel } = useWebRTC(socket, roomId, onMessage);

  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  useEffect(() => {
    // Only allow start when BOTH WebRTC and the DataChannel are fully stabilized
    if (connectionState === 'connected' && dataChannel && file && transferProgress.status === 'idle') {
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
    if (dataChannel && dataChannel.readyState === 'open') {
      sendFile(file, dataChannel);
      setIsReadyToStart(false);
    }
  };

  if (!file) {
    return <div className="p-8 text-center text-red-500">Error: No file selected.</div>;
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
          <h2 className="text-xl font-bold text-[var(--text-h)]">Sending File</h2>
        </div>
        <ConnectionStatus state={connectionState} />
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
        <p className="text-sm text-gray-500 font-medium mb-2">Share this link with the receiver:</p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--text-h)] focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="p-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
            title="Copy Link"
          >
            {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 border border-gray-100 rounded-xl">
        <p className="font-medium text-[var(--text-h)] truncate">{file.name}</p>
        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>

      {isReadyToStart && transferProgress.status === 'idle' && (
        <button 
          onClick={handleStartTransfer}
          className="w-full mb-6 bg-[var(--accent)] text-white font-medium py-3 rounded-xl hover:opacity-90 transition-all shadow-sm"
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
