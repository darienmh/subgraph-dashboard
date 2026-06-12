"use client";

import { StatCard } from "@/components/StatCard";
import { LiveChart } from "@/components/LiveChart";
import { useSubgraph, POLL_MS } from "@/lib/use-subgraph";

const fmt = (n?: number | null, d = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d });

const ms = (n?: number | null) => (n == null ? "—" : `${fmt(n, 1)} ms`);
const pct = (n?: number | null) => (n == null ? "—" : `${fmt(n, 1)}%`);

// Adaptive speed format so slow rates don't round to "0" (e.g. 0.17 b/s near head).
const fmtSpeed = (n?: number | null) =>
  n == null ? "—" : n >= 100 ? Math.round(n).toLocaleString("en-US") : n >= 10 ? n.toFixed(1) : n.toFixed(2);

function fmtEta(secs?: number | null) {
  if (secs == null || !Number.isFinite(secs)) return "—";
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m`;
  if (m > 0) return `~${m}m ${s % 60}s`;
  return `~${s}s`;
}

export default function Overview() {
  const { s, d, err, blocks, queries } = useSubgraph();

  const noMetrics = s != null && !s.metricsAvailable;
  const collecting = () => (noMetrics ? "metrics unavailable (tunnel :8040)" : "collecting…");
  const atChainTip = s?.chainLag != null && s.chainLag === 0;

  return (
    <>
      {err && <div className="card mb-4 border-red-500/30 text-red-300">{err}</div>}
      {s && !s.ok && (
        <div className="card mb-4 border-amber-500/30 text-amber-300">{s.error ?? "subgraph has no status"}</div>
      )}

      {/* Sync / chain position */}
      <div className="card mb-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="label">sync progress</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-white">{fmt(s?.syncPct, 2)}%</div>
          </div>
          <div className="text-right">
            <div className="label">{s?.synced ? "status" : "ETA"}</div>
            <div className="text-xl font-semibold text-brand-soft">
              {s?.synced ? (atChainTip ? "at chain tip" : "Live") : fmtEta(d?.etaSeconds)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-white/60">
          <span>indexed block: <b className="text-white">{fmt(s?.latestBlock)}</b></span>
          <span>head: <b className="text-white">{fmt(s?.chainHead)}</b></span>
          <span>behind: <b className="text-white">{fmt(s?.blocksBehind)}</b></span>
          {s?.chainLag != null && (
            <span>
              chain lag:{" "}
              <b className={s.chainLag > 5 ? "text-amber-300" : "text-white"}>{fmt(s.chainLag)} blocks</b>
            </span>
          )}
        </div>
      </div>

      {/* Robust lifetime averages (meaningful even when synced) */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="entities" value={fmt(s?.entityCount)} accent />
        <StatCard label="query latency" value={ms(s?.avg?.queryMs)} sub="lifetime avg" />
        <StatCard label="rpc latency" value={ms(s?.avg?.rpcMs)} sub="lifetime avg" />
        <StatCard label="block processing" value={ms(s?.avg?.blockMs)} sub="lifetime avg" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="cache hit" value={pct(s?.avg?.cacheHitPct)} sub="cumulative" />
        <StatCard
          label="reorgs"
          value={s?.reorgs == null ? "—" : fmt(s.reorgs)}
          sub="reverted blocks"
        />
        <StatCard
          label="postgres pool"
          value={s?.pool ? `${fmt(s.pool.checkedOut)}/${fmt(s.pool.size)}` : "—"}
          sub="in use / total"
        />
        <StatCard label="conn wait" value={s?.pool ? `${fmt(s.pool.waitMs, 1)} ms` : "—"} />
      </div>

      {/* Live activity (per-second rates — low when synced, but real) */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="label mb-2">activity: indexing (blocks/s)</div>
          {blocks.length > 1 ? (
            <LiveChart data={blocks} dataKey="blocks" color="#8b6cff" unit="b/s" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-white/40">{collecting()}</div>
          )}
          <div className="mt-2 text-xs text-white/40">
            now: <b className="text-white/70">{fmtSpeed(d?.blocksPerSec)}</b> b/s
          </div>
        </div>
        <div className="card">
          <div className="label mb-2">activity: queries/s (node)</div>
          {queries.length > 1 ? (
            <LiveChart data={queries} dataKey="queries" color="#34d399" unit="q/s" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-white/40">{collecting()}</div>
          )}
          <div className="mt-2 text-xs text-white/40">
            now: <b className="text-white/70">{fmt(d?.queriesPerSec, 2)}</b> q/s
          </div>
        </div>
      </div>

      {/* Errors */}
      {(s?.fatalError || (s?.nonFatalErrors?.length ?? 0) > 0) && (
        <div className="card border-red-500/30">
          <div className="label mb-2 text-red-300">indexing errors</div>
          {s?.fatalError && (
            <p className="text-sm text-red-300">
              <b>FATAL{s.fatalError.deterministic ? " (deterministic)" : ""}</b> {s.fatalError.message}
              {s.fatalError.block?.number ? ` (block ${s.fatalError.block.number})` : ""}
            </p>
          )}
          {s?.nonFatalErrors?.slice(0, 8).map((e, i) => (
            <p key={i} className="text-sm text-amber-300/80">• {e.message}</p>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-white/30">
        refreshes every {POLL_MS / 1000}s · {s ? new Date(s.ts).toLocaleTimeString() : "…"}
      </p>
    </>
  );
}
