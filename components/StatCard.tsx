export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`value mt-2 ${accent ? "text-brand-soft" : ""}`}>{value}</div>
      {sub != null && <div className="mt-1 text-sm text-white/50">{sub}</div>}
    </div>
  );
}
