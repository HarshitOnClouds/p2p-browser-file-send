import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { UploadCloud, File as FileIcon } from 'lucide-react';

const supportsOPFS = ('storage' in navigator && 'getDirectory' in navigator.storage);
const MAX_SIZE = supportsOPFS ? 1024 * 1024 * 1024 : 50 * 1024 * 1024;

export function DropZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  
  const fileInputRef = useRef(null);
  const socket = useSocket();
  const navigate = useNavigate();

  const handleFile = (file) => {
    setError('');
    if (!file) return;
    
    if (file.size > MAX_SIZE) {
      setError(`File size exceeds the ${supportsOPFS ? '1GB' : '50MB'} limit.`);
      return;
    }

    setSelectedFile(file);
    createRoom(file);
  };

  const createRoom = (file) => {
    if (!socket) {
      setError('Cannot connect to signaling server.');
      return;
    }
    
    setIsCreatingRoom(true);
    
    socket.once('room-created', ({ roomId }) => {
      setIsCreatingRoom(false);
      navigate(`/room/${roomId}`, { state: { file } });
    });

    socket.emit('create-room');
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white border border-[var(--border)] rounded-2xl shadow-[var(--shadow)]">
      <h2 className="text-2xl font-bold text-center text-[var(--text-h)] mb-6">P2P Web Share</h2>
      
      <div 
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
          isDragOver ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-12 h-12 text-black mb-4" />
        <p className="text-center font-medium text-[var(--text-h)]">
          Drag & drop a file here
        </p>
        <p className="text-sm text-black mt-1">or click to browse</p>
        <p className="text-xs text-black mt-4 max-w-xs text-center">
          Files are sent directly peer-to-peer. Limit {supportsOPFS ? '1GB' : '50MB'}.
        </p>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {selectedFile && !error && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center space-x-3">
          <FileIcon className="w-8 h-8 text-[var(--accent)]" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-[var(--text-h)] truncate">{selectedFile.name}</p>
            <p className="text-xs text-black">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          {isCreatingRoom && (
            <span className="text-xs font-semibold text-[var(--accent)] animate-pulse">Creating...</span>
          )}
        </div>
      )}

      <button
        disabled={!selectedFile || isCreatingRoom || !!error}
        className="w-full mt-6 bg-blue-600 text-white font-medium py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isCreatingRoom ? 'Creating Room...' : 'Share File'}
      </button>
    </div>
  );
}
