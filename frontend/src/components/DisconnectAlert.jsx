import { useNavigate } from 'react-router-dom';

export function DisconnectAlert() {
  const navigate = useNavigate();

  return (
    <div className="mt-6 p-4 border border-red-300 bg-red-50 rounded-xl text-center shadow-sm">
      <h3 className="text-red-600 font-bold mb-2">Connection Lost</h3>
      <p className="text-sm text-red-500 mb-4">
        Your peer has disconnected. The transfer was interrupted.
      </p>
      <div className="flex justify-center space-x-3">
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-white border border-[var(--border)] text-[var(--text-h)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          Share Again
        </button>
      </div>
    </div>
  );
}
