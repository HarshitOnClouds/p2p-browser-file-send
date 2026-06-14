export function ConnectionStatus({ state }) {
  let colorClass = '';
  let label = '';

  switch (state) {
    case 'new':
    case 'waiting':
      colorClass = 'bg-gray-400';
      label = 'Waiting for peer';
      break;
    case 'checking':
    case 'connecting':
      colorClass = 'bg-yellow-400';
      label = 'Connecting...';
      break;
    case 'connected':
    case 'completed':
      colorClass = 'bg-green-500';
      label = 'Connected';
      break;
    case 'disconnected':
      colorClass = 'bg-red-500';
      label = 'Peer disconnected';
      break;
    case 'failed':
      colorClass = 'bg-red-600';
      label = 'Connection failed';
      break;
    case 'closed':
      colorClass = 'bg-gray-600';
      label = 'Connection closed';
      break;
    default:
      colorClass = 'bg-gray-300';
      label = `Unknown (${state})`;
  }

  return (
    <div className="flex items-center space-x-2 bg-[var(--social-bg)] px-3 py-1.5 rounded-full border border-[var(--border)] shadow-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${colorClass} animate-pulse`}></span>
      <span className="text-sm font-medium text-[var(--text-h)]">{label}</span>
    </div>
  );
}
