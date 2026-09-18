export default function SpecChip({ children }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-accent/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
      {children}
    </span>
  );
}