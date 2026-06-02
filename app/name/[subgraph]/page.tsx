"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { ProgressBar } from "@/components/ProgressBar";
import { LiveChart } from "@/components/LiveChart";

interface Raw {
  blocksProcessed: number | null;
  queries: number | null;
  rpcCount: number | null;
  rpcSum: number | null;
  cacheHit: number | null;
  cacheTotal: number | null;
}

interface Snapshot {
  ok: boolean;
  error?: string;
  ts: number;
  subgraph: string;
  deployment?: string;
  synced?: boolean;
  health?: string;
  entityCount?: number;
  fatalError?: { message: string; block: { number: string } | null } | null;
  nonFatalErrors?: { message: string }[];
  chainHead?: number;
  latestBlock?: number;
  blocksBehind?: number;
  syncPct?: number;
  metricsAvailable?: boolean;
  raw?: Raw | null;
  pool?: { size: number; checkedOut: number; waitMs: number } | null;
}

interface Derived {
  blocksPerSec: number | null;
  queriesPerSec: number | null;
  rpcPerSec: number | null;
  rpcAvgMs: number | null;
  cacheHitPct: number | null;
  etaSeconds: number | null;
}

const POLL_MS = 10000;
const HISTORY = 30;

const fmt = (n?: number | null, d = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d });

function fmtEta(secs?: number | null) {
  if (secs == null || !Number.isFinite(secs)) return "—";
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m`;
  if (m > 0) return `~${m}m ${s % 60}s`;
  return `~${s}s`;
}

// Derive per-second rates from two consecutive raw snapshots (the client's poll window).
function derive(cur: Snapshot, prev: { ts: number; raw: Raw } | null): Derived | null {
  if (!cur.raw) return null; // metrics unavailable
  if (!prev) return { blocksPerSec: null, queriesPerSec: null, rpcPerSec: null, rpcAvgMs: null, cacheHitPct: null, etaSeconds: null };
  const dt = (cur.ts - prev.ts) / 1000;
  if (dt <= 0) return { blocksPerSec: null, queriesPerSec: null, rpcPerSec: null, rpcAvgMs: null, cacheHitPct: null, etaSeconds: null };

  const rate = (a: number | null, b: number | null) =>
    a != null && b != null ? Math.max((a - b) / dt, 0) : null;

  const blocksPerSec = rate(cur.raw.blocksProcessed, prev.raw.blocksProcessed);
  const queriesPerSec = rate(cur.raw.queries, prev.raw.queries);
  const rpcPerSec = rate(cur.raw.rpcCount, prev.raw.rpcCount);

  let rpcAvgMs: number | null = null;
  if (cur.raw.rpcCount != null && prev.raw.rpcCount != null && cur.raw.rpcSum != null && prev.raw.rpcSum != null) {
    const dc = cur.raw.rpcCount - prev.raw.rpcCount;
    const ds = cur.raw.rpcSum - prev.raw.rpcSum;
    rpcAvgMs = dc > 0 ? (ds / dc) * 1000 : null;
  }

  let cacheHitPct: number | null = null;
  if (cur.raw.cacheHit != null && prev.raw.cacheHit != null && cur.raw.cacheTotal != null && prev.raw.cacheTotal != null) {
    const dh = cur.raw.cacheHit - prev.raw.cacheHit;
    const dtot = cur.raw.cacheTotal - prev.raw.cacheTotal;
    cacheHitPct = dtot > 0 ? (dh / dtot) * 100 : null;
  }

  const etaSeconds = blocksPerSec && blocksPerSec > 0 ? (cur.blocksBehind ?? 0) / blocksPerSec : null;

  return { blocksPerSec, queriesPerSec, rpcPerSec, rpcAvgMs, cacheHitPct, etaSeconds };
}

export default function SubgraphDashboard() {
  const params = useParams();
  const subgraph = decodeURIComponent(String(params.subgraph ?? ""));

  const [s, setS] = useState<Snapshot | null>(null);
  const [d, setD] = useState<Derived | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<{ t: number; v: number }[]>([]);
  const [queries, setQueries] = useState<{ t: number; v: number }[]>([]);
  const prevRef = useRef<{ ts: number; raw: Raw } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    prevRef.current = null;
    setBlocks([]);
    setQueries([]);
    setD(null);

    const tick = async () => {
      try {
        const res = await fetch(`/api/stats?subgraph=${encodeURIComponent(subgraph)}`, { cache: "no-store" });
        const data: Snapshot = await res.json();
        if (!alive) return;
        setErr(null);
        setS(data);

        const der = derive(data, prevRef.current);
        setD(der);
        if (data.raw) prevRef.current = { ts: data.ts, raw: data.raw };

        if (der?.blocksPerSec != null)
          setBlocks((h) => [...h, { t: data.ts, v: der.blocksPerSec! }].slice(-HISTORY));
        if (der?.queriesPerSec != null)
          setQueries((h) => [...h, { t: data.ts, v: der.queriesPerSec! }].slice(-HISTORY));
      } catch {
        if (alive) setErr("no se pudo conectar con /api/stats");
      }
    };
    tick();
    timer.current = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [subgraph]);

  const healthColor =
    s?.health === "healthy" ? "bg-emerald-500/15 text-emerald-300"
    : s?.health === "unhealthy" ? "bg-amber-500/15 text-amber-300"
    : s?.health === "failed" ? "bg-red-500/15 text-red-300"
    : "bg-white/10 text-white/60";

  const noMetrics = s != null && !s.metricsAvailable;
  const collecting = (arr: unknown[]) => (noMetrics ? "métricas no disponibles (tunelea :8040)" : "recopilando…");

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-white/40 hover:text-white/70">← subgraphs</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {subgraph || "subgraph"} <span className="text-brand-soft">·</span> indexing
          </h1>
          {s?.deployment && <p className="mt-1 font-mono text-xs text-white/40">{s.deployment}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${healthColor}`}>● {s?.health ?? "…"}</span>
          <span className={`badge ${s?.synced ? "bg-emerald-500/15 text-emerald-300" : "bg-brand/15 text-brand-soft"}`}>
            {s?.synced ? "✓ synced" : "⏳ syncing"}
          </span>
        </div>
      </div>

      {err && <div className="card mb-4 border-red-500/30 text-red-300">{err}</div>}
      {s && !s.ok && (
        <div className="card mb-4 border-amber-500/30 text-amber-300">{s.error ?? "subgraph sin estado"}</div>
      )}

      <div className="card mb-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="label">progreso de sincronización</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-white">{fmt(s?.syncPct, 2)}%</div>
          </div>
          <div className="text-right">
            <div className="label">ETA</div>
            <div className="text-xl font-semibold text-brand-soft">{fmtEta(d?.etaSeconds)}</div>
          </div>
        </div>
        <ProgressBar pct={s?.syncPct ?? 0} />
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm text-white/60">
          <span>bloque indexado: <b className="text-white">{fmt(s?.latestBlock)}</b></span>
          <span>head: <b className="text-white">{fmt(s?.chainHead)}</b></span>
          <span>faltan: <b className="text-white">{fmt(s?.blocksBehind)}</b></span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="entidades" value={fmt(s?.entityCount)} accent />
        <StatCard label="velocidad" value={fmt(d?.blocksPerSec)} sub="bloques / s" />
        <StatCard label="queries" value={fmt(d?.queriesPerSec, 1)} sub="req / s (nodo)" />
        <StatCard label="cache hit" value={d?.cacheHitPct == null ? "—" : `${fmt(d?.cacheHitPct, 1)}%`} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="label mb-2">velocidad de indexado (bloques/s)</div>
          {blocks.length > 1 ? (
            <LiveChart data={blocks} dataKey="blocks" color="#8b6cff" unit="b/s" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-white/40">{collecting(blocks)}</div>
          )}
        </div>
        <div className="card">
          <div className="label mb-2">queries por segundo (nodo)</div>
          {queries.length > 1 ? (
            <LiveChart data={queries} dataKey="queries" color="#34d399" unit="q/s" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-white/40">{collecting(queries)}</div>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="RPC req/s" value={fmt(d?.rpcPerSec, 1)} />
        <StatCard label="RPC latencia" value={d?.rpcAvgMs == null ? "—" : `${fmt(d?.rpcAvgMs)} ms`} />
        <StatCard label="Postgres pool" value={s?.pool ? `${fmt(s.pool.checkedOut)}/${fmt(s.pool.size)}` : "—"} sub="en uso / total" />
        <StatCard label="conn wait" value={s?.pool ? `${fmt(s.pool.waitMs, 1)} ms` : "—"} />
      </div>

      {(s?.fatalError || (s?.nonFatalErrors?.length ?? 0) > 0) && (
        <div className="card border-red-500/30">
          <div className="label mb-2 text-red-300">errores de indexación</div>
          {s?.fatalError && (
            <p className="text-sm text-red-300">
              <b>FATAL</b> {s.fatalError.message}
              {s.fatalError.block?.number ? ` (bloque ${s.fatalError.block.number})` : ""}
            </p>
          )}
          {s?.nonFatalErrors?.slice(0, 5).map((e, i) => (
            <p key={i} className="text-sm text-amber-300/80">• {e.message}</p>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-white/30">
        actualiza cada {POLL_MS / 1000}s · {s ? new Date(s.ts).toLocaleTimeString() : "…"}
      </p>
    </main>
  );
}
