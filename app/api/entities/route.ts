import { NextResponse } from "next/server";
import { pgAvailable, pgQuery, schemaForDeployment } from "@/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Row {
  name: string;
  count: string | number;
  cols: string | number;
}

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
    const schema = await schemaForDeployment(deployment);
    if (!schema) {
      return NextResponse.json({ ok: false, ts: now, error: `no relational schema for deployment ${deployment}` });
    }

    // One row per entity table. n_live_tup is the live-row estimate maintained by
    // the stats collector (fast, no scan); reltuples is the fallback. Internal
    // tables (poi2$, *_data_sources$, …) contain a '$' and are excluded.
    const rows = await pgQuery<Row>(
      `SELECT c.relname AS name,
              COALESCE(s.n_live_tup, GREATEST(c.reltuples::bigint, 0)) AS count,
              (SELECT count(*) FROM information_schema.columns col
                 WHERE col.table_schema = $1 AND col.table_name = c.relname) AS cols
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE n.nspname = $1 AND c.relkind = 'r' AND strpos(c.relname, chr(36)) = 0
       ORDER BY count DESC`,
      [schema],
    );

    const entities = rows.map((r) => ({ name: r.name, count: Number(r.count), cols: Number(r.cols) }));
    const totalRows = entities.reduce((a, e) => a + e.count, 0);

    return NextResponse.json({ ok: true, ts: now, schema, count: entities.length, totalRows, entities });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[entities] query failed:", detail);
    return NextResponse.json({
      ok: false,
      ts: now,
      error: "entities query failed — is Postgres reachable (GRAPH_PG_URL / tunnel)?",
      detail,
    });
  }
}
