export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-ink-600">
      <div
        className="h-full rounded-full bg-linear-to-r from-brand-dark via-brand to-brand-soft transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
