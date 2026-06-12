import { NextResponse } from "next/server";
import { fetchStatus, fetchMetrics, SUBGRAPH } from "@/lib/graphnode";
import { findOne, sumBy, histogramAvg } from "@/lib/prometheus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// deployment_status: 1 preparing · 2 indexing · 3 stopped · 4 failed
function statusText(code: number | undefined, paused: boolean | null, synced: boolean): string {
  if (paused) return "paused";
  switch (code) {
    case 1: return "preparing";
    case 3: return "stopped";
    case 4: return "failed";
    case 2: return synced ? "Live" : "indexing";
    default: return synced ? "Live" : "indexing";
  }
}

export async function GET(req: Request) {
  const now = Date.now();
  const subgraph = new URL(req.url).searchParams.get("subgraph") || SUBGRAPH;

  if (!subgraph) {
    return NextResponse.json(
      { ok: false, error: "missing subgraph (use /name/<subgraph> or ?subgraph=)", ts: now },
      { status: 200 },
    );
  }

  const [status, metrics] = await Promise.all([fetchStatus(subgraph), fetchMetrics()]);

  if (!status) {
    return NextResponse.json(
      { ok: false, error: `subgraph "${subgraph}" not found or status endpoint down`, subgraph, ts: now },
      { status: 200 },
    );
  }

  const deployment = status.subgraph;
  const chain = status.chains?.[0] ?? ({} as IndexingChain);
  const chainHead = num(chain?.chainHeadBlock?.number);
  const latest = num(chain?.latestBlock?.number);
  const earliest = num(chain?.earliestBlock?.number);
  const lastHealthy = chain?.lastHealthyBlock?.number ? num(chain.lastHealthyBlock.number) : null;
  const blocksBehind = Math.max(chainHead - latest, 0);
  const syncPct = chainHead > 0 ? Math.min((latest / chainHead) * 100, 100) : 0;

  // Raw cumulative metrics — the client derives per-second rates from successive polls.
  let raw: Record<string, number | null> | null = null;
  let pool: { size: number; checkedOut: number; waitMs: number } | null = null;

  // Lifetime averages — robust even when synced (per-second rates trend to 0).
  let avg: { blockMs: number | null; queryMs: number | null; rpcMs: number | null; cacheHitPct: number | null } | null = null;
  let statusCode: number | undefined;
  let reorgs: number | undefined;
  let ethChainHead: number | undefined;

  if (metrics) {
    const dep = { deployment };
    raw = {
      blocksProcessed: sumBy(metrics, "deployment_blocks_processed_count", dep) ?? findOne(metrics, "deployment_head", dep) ?? null,
      queries: sumBy(metrics, "query_result_size_count") ?? null,
      rpcCount: sumBy(metrics, "deployment_eth_rpc_request_duration_count", dep) ?? sumBy(metrics, "eth_rpc_request_duration_count") ?? null,
      rpcSum: sumBy(metrics, "deployment_eth_rpc_request_duration_sum", dep) ?? sumBy(metrics, "eth_rpc_request_duration_sum") ?? null,
      cacheHit: sumBy(metrics, "query_cache_status_count", { cache_status: "hit" }) ?? null,
      cacheTotal: sumBy(metrics, "query_cache_status_count") ?? null,
    };

    // histogram averages (seconds -> ms)
    const queryAvg = histogramAvg(metrics, "query_execution_time", { deployment, status: "success" }) ?? histogramAvg(metrics, "query_execution_time");
    const blockAvg = histogramAvg(metrics, "deployment_block_processing_duration", dep);
    const rpcAvg = histogramAvg(metrics, "deployment_eth_rpc_request_duration", dep) ?? histogramAvg(metrics, "eth_rpc_request_duration");
    const cacheHit = sumBy(metrics, "query_cache_status_count", { cache_status: "hit" });
    const cacheTotal = sumBy(metrics, "query_cache_status_count");
    avg = {
      blockMs: blockAvg != null ? blockAvg * 1000 : null,
      queryMs: queryAvg != null ? queryAvg * 1000 : null,
      rpcMs: rpcAvg != null ? rpcAvg * 1000 : null,
      cacheHitPct: cacheHit != null && cacheTotal && cacheTotal > 0 ? (cacheHit / cacheTotal) * 100 : null,
    };

    statusCode = findOne(metrics, "deployment_status", dep);
    reorgs = sumBy(metrics, "deployment_reverted_blocks", dep);
    ethChainHead = findOne(metrics, "ethereum_chain_head_number", chain?.network ? { network: chain.network } : undefined)
      ?? findOne(metrics, "deployment_head", dep);

    const size = findOne(metrics, "store_connection_pool_size_count");
    const checkedOut = findOne(metrics, "store_connection_checkout_count");
    const waitMs = findOne(metrics, "store_connection_wait_time_ms");
    if (size != null || checkedOut != null || waitMs != null)
      pool = { size: size ?? 0, checkedOut: checkedOut ?? 0, waitMs: waitMs ?? 0 };
  }

  return NextResponse.json({
    ok: true,
    ts: now,
    subgraph,
    deployment,
    network: chain?.network ?? null,
    node: status.node ?? null,
    paused: status.paused ?? false,
    synced: status.synced,
    health: status.health,
    status: statusText(statusCode, status.paused ?? false, status.synced),
    entityCount: num(status.entityCount),
    fatalError: status.fatalError,
    nonFatalErrors: status.nonFatalErrors ?? [],
    chainHead,
    latestBlock: latest,
    earliestBlock: earliest,
    lastHealthyBlock: lastHealthy,
    ethChainHead: ethChainHead ?? null,
    blocksBehind,
    chainLag: ethChainHead != null ? Math.max(ethChainHead - latest, 0) : null,
    reorgs: reorgs ?? null,
    syncPct,
    avg,
    metricsAvailable: !!metrics,
    raw,
    pool,
  });
}

interface IndexingChain {
  network?: string | null;
  chainHeadBlock?: { number: string } | null;
  latestBlock?: { number: string } | null;
  earliestBlock?: { number: string } | null;
  lastHealthyBlock?: { number: string } | null;
}
