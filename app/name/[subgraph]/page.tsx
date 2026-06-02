"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { ProgressBar } from "@/components/ProgressBar";
import { LiveChart } from "@/components/LiveChart";

interface Stats {
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
  blocksPerSec?: number | null;
  queriesPerSec?: number | null;
  rpcPerSec?: number | null;
  rpcAvgMs?: number | null;
  cacheHitPct?: number | null;
  pool?: { size: number; checkedOut: number; waitMs: number } | null;
  etaSeconds?: number | null;
}

const POLL_MS = 3000;
const HISTORY = 40;

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

export default function SubgraphDashboard() {
  const params = useParams();
  const subgraph = decodeURIComponent(String(params.subgraph ?? ""));

  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<{ t: number; v: number }[]>([]);
  const [queries, setQueries] = useState<{ t: number; v: number }[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setBlocks([]);
    setQueries([]);
    const tick = async () => {
      try {
        const res = await fetch(`/api/stats?subgraph=${encodeURIComponent(subgraph)}`, { cache: "no-store" });
        const data: Stats = await res.json();
        if (!alive) return;
        setErr(null);
        setS(data);
        if (data.blocksPerSec != null)
          setBlocks((h) => [...h, { t: data.ts, v: data.blocksPerSec! }].slice(-HISTORY));
        if (data.queriesPerSec != null)
          setQueries((h) => [...h, { t: data.ts, v: data.queriesPerSec! }].slice(-HISTORY));
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

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {/* header */}
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

      {/* sync */}
      <div className="card mb-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="label">progreso de sincronización</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-white">{fmt(s?.syncPct, 2)}%</div>
          </div>
          <div className="text-right">
            <div className="label">ETA</div>
            <div className="text-xl font-semibold text-brand-soft">{fmtEta(s?.etaSeconds)}</div>
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
        <StatCard label="velocidad" value={fmt(s?.blocksPerSec)} sub="bloques / s" />
        <StatCard label="queries" value={fmt(s?.queriesPerSec, 1)} sub="req / s (nodo)" />
        <StatCard label="cache hit" value={s?.cacheHitPct == null ? "—" : `${fmt(s?.cacheHitPct, 1)}%`} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="label mb-2">velocidad de indexado (bloques/s)</div>
          {blocks.length > 1 ? (
            <LiveChart data={blocks} dataKey="blocks" color="#8b6cff" unit="b/s" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-white/40">
              {s?.metricsAvailable ? "recopilando…" : "métricas no disponibles (tunelea :8040)"}
            </div>
          )}
        </div>
        <div className="card">
          <div className="label mb-2">queries por segundo (nodo)</div>
          {queries.length > 1 ? (
            <LiveChart data={queries} dataKey="queries" color="#34d399" unit="q/s" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-white/40">
              {s?.metricsAvailable ? "recopilando…" : "métricas no disponibles (tunelea :8040)"}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="RPC req/s" value={fmt(s?.rpcPerSec, 1)} />
        <StatCard label="RPC latencia" value={s?.rpcAvgMs == null ? "—" : `${fmt(s?.rpcAvgMs)} ms`} />
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
