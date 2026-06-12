import { NextResponse } from "next/server";
import { recordSample } from "@/lib/series";
import { SUBGRAPH } from "@/lib/graphnode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const subgraph = new URL(req.url).searchParams.get("subgraph") || SUBGRAPH;
  if (!subgraph) {
    return NextResponse.json({ ok: false, ts: Date.now(), error: "missing subgraph", samples: [] });
  }
  const samples = await recordSample(subgraph);
  return NextResponse.json({ ok: true, ts: Date.now(), samples });
}
