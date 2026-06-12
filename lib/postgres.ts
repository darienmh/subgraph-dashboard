import { Pool } from "pg";

// Read-only connection to graph-node's Postgres (role `dash_ro`).
// dev:   tunnel the container's 5432 to localhost and point GRAPH_PG_PG_URL there.
// deploy: postgresql://dash_ro:***@graph-postgres:5432/graph-node over graphnet.
const PG_URL = process.env.GRAPH_PG_URL || "";
let _pool: Pool | null = null;

function maskedUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = "***";
    return u.toString();
  } catch {
    return "(invalid PG_URL)";
  }
}

function pool(): Pool | null {
  if (!PG_URL) return null;
  if (!_pool) {
    console.log("[postgres] creating pool — connecting to:", maskedUrl(PG_URL));
    _pool = new Pool({
      connectionString: PG_URL,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      statement_timeout: 8000,
    });
    _pool.on("error", (err) => {
      console.error("[postgres] pool error:", err.message);
    });
    _pool.on("connect", () => {
      console.log("[postgres] new client connected");
    });
  }
  return _pool;
}

export function pgAvailable(): boolean {
  return !!PG_URL;
}

export async function pgQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = pool();
  if (!p) throw new Error("GRAPH_PG_PG_URL not set");
  const res = await p.query(sql, params);
  return res.rows as T[];
}

/** Resolve a deployment's relational schema (sgdN), validated to prevent injection. */
export async function schemaForDeployment(deployment: string): Promise<string | null> {
  const rows = await pgQuery<{ name: string }>(
    "SELECT name FROM public.deployment_schemas WHERE subgraph = $1 LIMIT 1",
    [deployment],
  );
  const name = rows[0]?.name;
  return name && /^sgd\d+$/.test(name) ? name : null;
}
