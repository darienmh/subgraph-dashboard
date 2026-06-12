"use client";

import Link from "next/link";
import { useSubgraph } from "@/lib/use-subgraph";
import { ProgressBar } from "@/components/ProgressBar";

const fmt = (n?: number | null, d = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d });

const healthColor = (h?: string) =>
  h === "healthy" ? "bg-emerald-500/15 text-emerald-300"
  : h === "unhealthy" ? "bg-amber-500/15 text-amber-300"
  : h === "failed" ? "bg-red-500/15 text-red-300"
  : "bg-white/10 text-white/60";

const statusColor = (st?: string) =>
  st === "Live" ? "bg-emerald-500/15 text-emerald-300"
  : st === "indexing" || st === "preparing" ? "bg-brand/15 text-brand-soft"
  : st === "failed" ? "bg-red-500/15 text-red-300"
  : st === "paused" || st === "stopped" ? "bg-amber-500/15 text-amber-300"
  : "bg-white/10 text-white/60";

export function Header() {
  const { subgraph, s } = useSubgraph();

  return (
    <div className="mb-5">
      <Link href="/" className="text-xs text-white/40 hover:text-white/70">← subgraphs</Link>

      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{subgraph || "subgraph"}</h1>
          {s?.deployment && <p className="mt-1 truncate font-mono text-xs text-white/40">{s.deployment}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${statusColor(s?.status)}`}>{s?.status ?? "…"}</span>
          <span className={`badge ${healthColor(s?.health)}`}>● {s?.health ?? "…"}</span>
          {s?.paused && <span className="badge bg-amber-500/15 text-amber-300">paused</span>}
        </div>
      </div>

      {/* meta strip */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-white/50">network <b className="text-white/80">{s?.network ?? "—"}</b></span>
        <span className="text-white/50">node <b className="text-white/80">{s?.node ?? "—"}</b></span>
        <span className="text-white/50">entities <b className="text-white/80">{fmt(s?.entityCount)}</b></span>
        <span className="text-white/50">progress <b className="text-white/80">{fmt(s?.syncPct, 1)}%</b></span>
      </div>

      <div className="mt-3">
        <ProgressBar pct={s?.syncPct ?? 0} />
      </div>
    </div>
  );
}
