import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-side proxy to graph-node's GraphQL query endpoint (:8000). The browser
// posts here instead of hitting graph-node directly, so the endpoint (and any
// API key) never leaves the host and there's no CORS to deal with.
const BASE = process.env.GRAPH_QUERY_URL || "";

export async function POST(req: Request) {
  if (!BASE) {
    return NextResponse.json({ errors: [{ message: "query endpoint not configured (set GRAPH_QUERY_URL)" }] });
  }
  let body: { query?: string; variables?: unknown; deployment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: [{ message: "invalid JSON body" }] });
  }
  const { query, variables, deployment } = body;
  if (!deployment) return NextResponse.json({ errors: [{ message: "missing deployment" }] });
  if (!query) return NextResponse.json({ errors: [{ message: "missing query" }] });

  const url = `${BASE.replace(/\/$/, "")}/subgraphs/id/${encodeURIComponent(deployment)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: variables ?? undefined }),
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ errors: [{ message: "query failed: " + (e instanceof Error ? e.message : String(e)) }] });
  }
}
