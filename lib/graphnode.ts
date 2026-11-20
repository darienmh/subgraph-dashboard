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
  if (!STATUS_URL) {
    console.error("[graphnode] fetchStatus: GRAPH_STATUS_URL is not set");
    return null;
  }
  if (!subgraphName) return null;
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
    if (!res.ok) {
      console.error(`[graphnode] fetchStatus: HTTP ${res.status} from ${STATUS_URL}`);
      return null;
    }
    const json = await res.json();
    const result = json?.data?.indexingStatusForCurrentVersion ?? null;
    if (!result) {
      console.warn(`[graphnode] fetchStatus: subgraph "${subgraphName}" not found. GraphQL errors: ${JSON.stringify(json?.errors)}`);
    }
    return result;
  } catch (err) {
    console.error(`[graphnode] fetchStatus: failed to reach ${STATUS_URL} —`, err);
    return null;
  }
}

export async function fetchMetrics(): Promise<Sample[] | null> {
  if (!METRICS_URL) return null;
  try {
    const res = await fetch(METRICS_URL, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[graphnode] fetchMetrics: HTTP ${res.status} from ${METRICS_URL}`);
      return null;
    }
    return parsePrometheus(await res.text());
  } catch (err) {
    console.error(`[graphnode] fetchMetrics: failed to reach ${METRICS_URL} —`, err);
    return null;
  }
}
