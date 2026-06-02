import { NextResponse } from "next/server";
import { fetchStatus, fetchMetrics, SUBGRAPH } from "@/lib/graphnode";
import { findOne, sumBy } from "@/lib/prometheus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: Request) {
  const now = Date.now();
  const subgraph = new URL(req.url).searchParams.get("subgraph") || SUBGRAPH;

  if (!subgraph) {
    return NextResponse.json(
      { ok: false, error: "falta el subgraph (usa /name/<subgraph> o ?subgraph=)", ts: now },
      { status: 200 },
    );
  }

  const [status, metrics] = await Promise.all([fetchStatus(subgraph), fetchMetrics()]);

  if (!status) {
    return NextResponse.json(
      { ok: false, error: `subgraph "${subgraph}" no encontrado o status endpoint caído`, subgraph, ts: now },
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

  // Raw cumulative metrics — the client derives per-second rates from successive polls.
  let raw: Record<string, number | null> | null = null;
  let pool: { size: number; checkedOut: number; waitMs: number } | null = null;

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
    raw,
    pool,
  });
}

interface IndexingChain {
  chainHeadBlock?: { number: string } | null;
  latestBlock?: { number: string } | null;
  earliestBlock?: { number: string } | null;
}
