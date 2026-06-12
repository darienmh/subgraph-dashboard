import { NextResponse } from "next/server";
import { pgAvailable, pgQuery } from "@/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const now = Date.now();
  const deployment = new URL(req.url).searchParams.get("deployment") || "";

  if (!pgAvailable()) {
    return NextResponse.json({ ok: false, ts: now, error: "Postgres not configured (set GRAPH_PG_URL)" });
  }
  if (!deployment) {
    return NextResponse.json({ ok: false, ts: now, error: "missing deployment" });
  }

  try {
    const [ver] = await pgQuery<{ id: string; deployed_at: string }>(
      `SELECT id, to_timestamp(created_at)::text AS deployed_at
       FROM subgraphs.subgraph_version WHERE deployment = $1 ORDER BY created_at DESC LIMIT 1`,
      [deployment],
    );
    const [schema] = await pgQuery<{ name: string; shard: string; network: string }>(
      `SELECT name, shard, network FROM public.deployment_schemas WHERE subgraph = $1 LIMIT 1`,
      [deployment],
    );
    // Single deployment per node here, so LIMIT 1 is safe. Join via
    // subgraph_deployment.manifest if you run several deployments.
    const [man] = await pgQuery<{ spec_version: string; features: string[]; start_block_number: number | null }>(
      `SELECT spec_version, features, start_block_number FROM subgraphs.subgraph_manifest LIMIT 1`,
    );

    return NextResponse.json({
      ok: true,
      ts: now,
      deployment,
      versionId: ver?.id ?? null,
      deployedAt: ver?.deployed_at ?? null,
      schema: schema?.name ?? null,
      shard: schema?.shard ?? null,
      network: schema?.network ?? null,
      specVersion: man?.spec_version ?? null,
      features: man?.features ?? [],
      startBlock: man?.start_block_number ?? null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ts: now,
      error: "details query failed — is Postgres reachable (GRAPH_PG_URL / tunnel)?",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
