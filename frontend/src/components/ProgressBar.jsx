export function ProgressBar({ percent, speedMBps, label }) {
  return (
    <div className="w-full mt-4">
      <div className="flex justify-between text-sm mb-1 text-[var(--text)]">
        <span className="font-semibold">{label}</span>
        <span>{percent}% &middot; {speedMBps} MB/s</span>
      </div>
      <div className="w-full bg-[var(--border)] rounded-full h-3 overflow-hidden">
        <div 
          className="bg-[var(--accent)] h-3 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}
