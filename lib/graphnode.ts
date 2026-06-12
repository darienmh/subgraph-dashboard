import { parsePrometheus, type Sample } from "./prometheus";

export const SUBGRAPH = process.env.SUBGRAPH_NAME ?? "";
const STATUS_URL = process.env.GRAPH_STATUS_URL ?? "";
const METRICS_URL = process.env.GRAPH_METRICS_URL ?? "";

export interface IndexingStatus {
  subgraph: string;
  synced: boolean;
  health: string;
  entityCount: string;
  node: string | null;
  paused: boolean | null;
  fatalError: { message: string; deterministic?: boolean; block: { number: string } | null } | null;
  nonFatalErrors: { message: string }[];
  chains: {
    network: string | null;
    chainHeadBlock: { number: string } | null;
    latestBlock: { number: string } | null;
    earliestBlock: { number: string } | null;
    lastHealthyBlock: { number: string } | null;
  }[];
}

export async function fetchStatus(subgraphName: string): Promise<IndexingStatus | null> {
  if (!STATUS_URL || !subgraphName) return null;
  const query = `{
    indexingStatusForCurrentVersion(subgraphName: ${JSON.stringify(subgraphName)}) {
      subgraph synced health entityCount node paused
      fatalError { message deterministic block { number } }
      nonFatalErrors { message }
      chains { network chainHeadBlock { number } latestBlock { number } earliestBlock { number } lastHealthyBlock { number } }
    }
  }`;
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
