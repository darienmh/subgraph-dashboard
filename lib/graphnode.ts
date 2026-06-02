import { parsePrometheus, type Sample } from "./prometheus";

export const SUBGRAPH = process.env.SUBGRAPH_NAME ?? "";
const STATUS_URL = process.env.GRAPH_STATUS_URL ?? "";
const METRICS_URL = process.env.GRAPH_METRICS_URL ?? "";

export interface IndexingStatus {
  subgraph: string;
  synced: boolean;
  health: string;
  entityCount: string;
  fatalError: { message: string; block: { number: string } | null } | null;
  nonFatalErrors: { message: string }[];
  chains: {
    chainHeadBlock: { number: string } | null;
    latestBlock: { number: string } | null;
    earliestBlock: { number: string } | null;
  }[];
}

export async function fetchStatus(): Promise<IndexingStatus | null> {
  const query = `{
    indexingStatusForCurrentVersion(subgraphName: "${SUBGRAPH}") {
      subgraph synced health entityCount
      fatalError { message block { number } }
      nonFatalErrors { message }
      chains { chainHeadBlock { number } latestBlock { number } earliestBlock { number } }
    }
  }`;
  if (!STATUS_URL) return null;
  try {
    const res = await fetch(STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    const json = await res.json();
    return json?.data?.indexingStatusForCurrentVersion ?? null;
  } catch {
    return null;
  }
}

export async function fetchMetrics(): Promise<Sample[] | null> {
  if (!METRICS_URL) return null;
  try {
    const res = await fetch(METRICS_URL, { cache: "no-store" });
    if (!res.ok) return null;
    return parsePrometheus(await res.text());
  } catch {
    return null;
  }
}
