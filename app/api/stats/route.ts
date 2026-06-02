import { NextResponse } from "next/server";
import { fetchStatus, fetchMetrics, SUBGRAPH } from "@/lib/graphnode";
import { findOne, sumBy } from "@/lib/prometheus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Counters are cumulative; remember the previous scrape to derive per-second rates.
let prev: { ts: number; blocksProcessed?: number; queries?: number; rpc?: number } | null = null;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET() {
  const now = Date.now();
  const [status, metrics] = await Promise.all([fetchStatus(), fetchMetrics()]);

  if (!status) {
    return NextResponse.json(
      { ok: false, error: "no status (subgraph not found or status endpoint down)", subgraph: SUBGRAPH, ts: now },
      { status: 200 },
    );
  }

  const deployment = status.subgraph;
  const chain = status.chains?.[0] ?? ({} as IndexingChain);
  const chainHead = num(chain?.chainHeadBlock?.number);
  const latest = num(chain?.latestBlock?.number);
  const earliest = num(chain?.earliestBlock?.number);
  const blocksBehind = Math.max(chainHead - latest, 0);
  const syncPct = chainHead > 0 ? Math.min((latest / chainHead) * 100, 100) : 0;

  // --- metrics-derived (optional; null when metrics endpoint unreachable) ---
  let blocksPerSec: number | null = null;
  let queriesPerSec: number | null = null;
  let rpcPerSec: number | null = null;
  let rpcAvgMs: number | null = null;
  let cacheHitPct: number | null = null;
  let pool: { size: number; checkedOut: number; waitMs: number } | null = null;
  let etaSeconds: number | null = null;

  if (metrics) {
    const dep = { deployment };
    const blocksProcessed = sumBy(metrics, "deployment_blocks_processed_count", dep) ?? findOne(metrics, "deployment_head", dep);
    const queries = sumBy(metrics, "query_result_size_count");
    const rpcCount = sumBy(metrics, "eth_rpc_request_duration_count");
    const rpcSum = sumBy(metrics, "eth_rpc_request_duration_sum");

    if (prev) {
      const dt = (now - prev.ts) / 1000;
      if (dt > 0) {
        if (blocksProcessed != null && prev.blocksProcessed != null)
          blocksPerSec = Math.max((blocksProcessed - prev.blocksProcessed) / dt, 0);
        if (queries != null && prev.queries != null)
          queriesPerSec = Math.max((queries - prev.queries) / dt, 0);
        if (rpcCount != null && prev.rpc != null)
          rpcPerSec = Math.max((rpcCount - prev.rpc) / dt, 0);
      }
    }
    prev = { ts: now, blocksProcessed: blocksProcessed ?? undefined, queries: queries ?? undefined, rpc: rpcCount ?? undefined };

    if (rpcCount && rpcSum) rpcAvgMs = (rpcSum / rpcCount) * 1000;

    const hit = sumBy(metrics, "query_cache_status_count", { cache_status: "hit" });
    const totalCache = sumBy(metrics, "query_cache_status_count");
    if (hit != null && totalCache && totalCache > 0) cacheHitPct = (hit / totalCache) * 100;

    const size = findOne(metrics, "store_connection_pool_size_count");
    const checkedOut = findOne(metrics, "store_connection_checkout_count");
    const waitMs = findOne(metrics, "store_connection_wait_time_ms");
    if (size != null || checkedOut != null || waitMs != null)
      pool = { size: size ?? 0, checkedOut: checkedOut ?? 0, waitMs: waitMs ?? 0 };

    if (blocksPerSec && blocksPerSec > 0) etaSeconds = blocksBehind / blocksPerSec;
  }

  return NextResponse.json({
    ok: true,
    ts: now,
    subgraph: SUBGRAPH,
    deployment,
    synced: status.synced,
    health: status.health,
    entityCount: num(status.entityCount),
    fatalError: status.fatalError,
    nonFatalErrors: status.nonFatalErrors ?? [],
    chainHead,
    latestBlock: latest,
    earliestBlock: earliest,
    blocksBehind,
    syncPct,
    metricsAvailable: !!metrics,
    blocksPerSec,
    queriesPerSec,
    rpcPerSec,
    rpcAvgMs,
    cacheHitPct,
    pool,
    etaSeconds,
  });
}

interface IndexingChain {
  chainHeadBlock?: { number: string } | null;
  latestBlock?: { number: string } | null;
  earliestBlock?: { number: string } | null;
}
