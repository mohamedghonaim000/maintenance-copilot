export default function StatusLight({ label, tone = 'success', pulse = false }) {
  const toneClass = tone === 'amber' ? 'text-accent bg-accent' : 'text-success bg-success';

  return (
    <span className="inline-flex items-center gap-2 text-xs text-text-muted">
      <span className={`h-2 w-2 rounded-full ${toneClass} ${pulse ? 'animate-[status-pulse_2s_ease-in-out_infinite]' : ''}`} aria-hidden="true" />
      <span className="font-mono uppercase tracking-[0.08em]">{label}</span>
    </span>
  );
}