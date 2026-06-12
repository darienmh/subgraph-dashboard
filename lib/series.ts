import { fetchMetrics, fetchStatus } from "./graphnode";
import { sumBy, findOne } from "./prometheus";

// In-memory time series, one ring buffer per subgraph. Each call to recordSample
// appends one point; the Analytics page polls it, so sampling happens while the
// tab is open and the history survives navigation (until the server restarts).
// graph-node exposes instantaneous values only — for durable history pair it with
// a real Prometheus + Grafana.

export interface Sample {
  ts: number;
  chainHead: number;
  latestBlock: number;
  entityCount: number;
  blocksProcessed: number | null; // cumulative counter; client derives speed
  queries: number | null;
}

const CAP = 480; // points kept per subgraph
const store = new Map<string, Sample[]>();

export async function recordSample(subgraph: string): Promise<Sample[]> {
  const [status, metrics] = await Promise.all([fetchStatus(subgraph), fetchMetrics()]);
  if (!status) return store.get(subgraph) ?? [];

  const deployment = status.subgraph;
  const chain = status.chains?.[0];
  const sample: Sample = {
    ts: Date.now(),
    chainHead: Number(chain?.chainHeadBlock?.number ?? 0),
    latestBlock: Number(chain?.latestBlock?.number ?? 0),
    entityCount: Number(status.entityCount ?? 0),
    blocksProcessed: metrics
      ? sumBy(metrics, "deployment_blocks_processed_count", { deployment }) ??
        findOne(metrics, "deployment_head", { deployment }) ??
        null
      : null,
    queries: metrics ? sumBy(metrics, "query_result_size_count") ?? null : null,
  };

  const arr = store.get(subgraph) ?? [];
  arr.push(sample);
  if (arr.length > CAP) arr.splice(0, arr.length - CAP);
  store.set(subgraph, arr);
  return arr;
}
