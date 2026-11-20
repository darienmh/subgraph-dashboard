"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiPath } from "@/lib/api-path";

export interface Raw {
  blocksProcessed: number | null;
  queries: number | null;
  rpcCount: number | null;
  rpcSum: number | null;
  cacheHit: number | null;
  cacheTotal: number | null;
}

export interface Snapshot {
  ok: boolean;
  error?: string;
  ts: number;
  subgraph: string;
  deployment?: string;
  network?: string | null;
  node?: string | null;
  paused?: boolean;
  synced?: boolean;
  health?: string;
  status?: string;
  entityCount?: number;
  fatalError?: { message: string; deterministic?: boolean; block: { number: string } | null } | null;
  nonFatalErrors?: { message: string }[];
  chainHead?: number;
  latestBlock?: number;
  earliestBlock?: number;
  lastHealthyBlock?: number | null;
  ethChainHead?: number | null;
  blocksBehind?: number;
  chainLag?: number | null;
  reorgs?: number | null;
  syncPct?: number;
  avg?: { blockMs: number | null; queryMs: number | null; rpcMs: number | null; cacheHitPct: number | null } | null;
  metricsAvailable?: boolean;
  raw?: Raw | null;
  pool?: { size: number; checkedOut: number; waitMs: number } | null;
}

export interface Derived {
  blocksPerSec: number | null;
  queriesPerSec: number | null;
  rpcPerSec: number | null;
  etaSeconds: number | null;
}

const POLL_MS = 10000;
const HISTORY = 30;

// Derive per-second rates from two consecutive raw snapshots (the poll window).
function derive(cur: Snapshot, prev: { ts: number; raw: Raw } | null): Derived | null {
  if (!cur.raw) return null;
  if (!prev) return { blocksPerSec: null, queriesPerSec: null, rpcPerSec: null, etaSeconds: null };
  const dt = (cur.ts - prev.ts) / 1000;
  if (dt <= 0) return { blocksPerSec: null, queriesPerSec: null, rpcPerSec: null, etaSeconds: null };

  const rate = (a: number | null, b: number | null) =>
    a != null && b != null ? Math.max((a - b) / dt, 0) : null;

  const blocksPerSec = rate(cur.raw.blocksProcessed, prev.raw.blocksProcessed);
  const queriesPerSec = rate(cur.raw.queries, prev.raw.queries);
  const rpcPerSec = rate(cur.raw.rpcCount, prev.raw.rpcCount);
  const etaSeconds = blocksPerSec && blocksPerSec > 0 ? (cur.blocksBehind ?? 0) / blocksPerSec : null;

  return { blocksPerSec, queriesPerSec, rpcPerSec, etaSeconds };
}

export interface SubgraphState {
  subgraph: string;
  s: Snapshot | null;
  d: Derived | null;
  err: string | null;
  blocks: { t: number; v: number }[];
  queries: { t: number; v: number }[];
}

const Ctx = createContext<SubgraphState | null>(null);

export function SubgraphProvider({ subgraph, children }: { subgraph: string; children: React.ReactNode }) {
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
        const res = await fetch(apiPath(`/api/stats?subgraph=${encodeURIComponent(subgraph)}`), { cache: "no-store" });
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
        if (alive) setErr("couldn't reach /api/stats");
      }
    };
    tick();
    timer.current = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [subgraph]);

  return <Ctx.Provider value={{ subgraph, s, d, err, blocks, queries }}>{children}</Ctx.Provider>;
}

export function useSubgraph(): SubgraphState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSubgraph must be used within <SubgraphProvider>");
  return ctx;
}

export { POLL_MS };
