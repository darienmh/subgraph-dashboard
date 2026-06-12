# Subgraph Dashboard

Real-time monitoring dashboard for a self-hosted **graph-node** subgraph (Next.js).
A Studio/Ormi-style UI you can run against your own node — no third-party platform.

It reads everything server-side (no CORS, nothing internal exposed to the browser)
and serves clean JSON to the UI. Tabs:

| Tab | Shows | Data source |
|---|---|---|
| **Overview** | sync %, chain lag, status, lifetime query/RPC/block latencies, cache hit, reorgs, Postgres pool, errors | index-status `:8030` + Prometheus `:8040` |
| **Logs** | live graph-node logs with min-level / time-range / search filters | `docker logs` via the Docker Engine API |
| **Entities** | per-entity row counts + column counts | Postgres (`sgdN.*`) |
| **Analytics** | chain head, entity count, indexing speed over time | Prometheus + index-status (in-memory sampling) |
| **Endpoints** | query URLs, cURL/JS examples, GraphQL playground | graph-node query endpoint `:8000` (proxied) |
| **Details** | deployment id, internal version, deploy date, network/shard/schema, spec version, features, start/earliest/latest block | Postgres (`subgraphs.*`, `public.deployment_schemas`) + index-status |

Each tab degrades gracefully: if a source isn't wired up, that tab shows a notice
instead of breaking (e.g. no `GRAPH_PG_URL` → Entities/Details say so).

## Data sources

| Source | Used for | Port / access |
|---|---|---|
| **index-status GraphQL** | sync, health, blocks, entity count, network | graph-node `:8030` |
| **Prometheus metrics** | latencies, reorgs, pool, chain head | graph-node `:8040` |
| **Docker Engine API** | the Logs tab (`docker logs <container>`) | unix socket / TCP |
| **Postgres** | Entities + Details | graph-node DB (read-only role) |

## Environment variables

Copy `.env.example` to `.env` (deploy) or `.env.local` (dev) and fill in:

| Var | What | Required for |
|---|---|---|
| `SUBGRAPH_NAME` | default subgraph name (optional; usually viewed at `/name/<subgraph>`) | — |
| `GRAPH_STATUS_URL` | index-status GraphQL endpoint | Overview, Details |
| `GRAPH_METRICS_URL` | Prometheus metrics endpoint (empty = status-only) | Overview rates |
| `GRAPH_CONTAINER` | graph-node container name to read logs from (default `graph-node`) | Logs |
| `DOCKER_HOST` | Docker Engine API (empty = `/var/run/docker.sock`) | Logs |
| `GRAPH_PG_URL` | read-only Postgres connection string (empty = tabs disabled) | Entities, Details |
| `GRAPH_QUERY_URL` | graph-node query endpoint `:8000` (proxied; empty = playground off) | Endpoints |
| `DASH_HOST` | public hostname for the Traefik router | deploy only |
| `GRAPH_NETWORK` | graph-node's docker network name (default `graph-node_graph`) | deploy only |

## Local development

Everything the dashboard reads is bound to the server's localhost / docker
network, so dev works entirely over SSH tunnels — nothing has to be public.

```bash
cp .env.example .env.local
npm install
```

Open the tunnels you need (one terminal each, or background with `-f`):

```bash
# index-status (:8030) + Prometheus (:8040)  -> Overview / Details
ssh -nNT -L 8030:localhost:8030 -L 8040:localhost:8040 user@your-server

# Docker socket -> Logs tab
ssh -nNT -L 2376:/var/run/docker.sock user@your-server

# Postgres -> Entities / Details (use the postgres container's IP, see below)
PG_IP=$(ssh user@your-server "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' graph-postgres")
ssh -nNT -L 5433:$PG_IP:5432 user@your-server

# query endpoint (:8000) -> Endpoints playground
ssh -nNT -L 8000:localhost:8000 user@your-server
```

Matching `.env.local`:

```ini
SUBGRAPH_NAME=your-subgraph
GRAPH_STATUS_URL=http://localhost:8030/graphql
GRAPH_METRICS_URL=http://localhost:8040/metrics
DOCKER_HOST=http://localhost:2376
GRAPH_CONTAINER=graph-node
GRAPH_PG_URL=postgresql://dash_ro:<password>@localhost:5433/graph-node
GRAPH_QUERY_URL=http://localhost:8000
```

```bash
npm run dev      # http://localhost:3009  ->  /name/<subgraph>
```

## Read-only Postgres role (Entities & Details)

The dashboard only SELECTs, so it connects with a dedicated read-only role rather
than the superuser. Create it once per graph-node host:

```bash
# edit the password in the script first
docker exec -i graph-postgres psql -U graph-node -d graph-node \
  < scripts/setup-readonly-role.sql
```

`scripts/setup-readonly-role.sql` creates `dash_ro` and grants `SELECT` on
graph-node's metadata schemas plus every subgraph data schema (`sgdN`), resolved
dynamically. Then point `GRAPH_PG_URL` at it.

## Deploy (behind Traefik)

The container joins graph-node's docker network (reaches `graph-node:8030/8040`
and `graph-postgres:5432` directly) and mounts the Docker socket read-only for
logs. Nothing internal is exposed publicly.

```bash
# 1. read-only role (see above)
docker exec -i graph-postgres psql -U graph-node -d graph-node < scripts/setup-readonly-role.sql

# 2. configure
cp .env.example .env
#   SUBGRAPH_NAME=your-subgraph
#   GRAPH_STATUS_URL=http://graph-node:8030/graphql
#   GRAPH_METRICS_URL=http://graph-node:8040/metrics
#   GRAPH_CONTAINER=graph-node
#   GRAPH_PG_URL=postgresql://dash_ro:<password>@graph-postgres:5432/graph-node
#   GRAPH_QUERY_URL=http://graph-node:8000
#   DASH_HOST=subgraph-dash.your-domain.com
#   (leave DOCKER_HOST empty -> uses the mounted /var/run/docker.sock)

# 3. run
docker compose build
docker compose up -d
```

Add a DNS record for `DASH_HOST` → your server, behind your TLS.

## Security

- The UI is **public by default** (read-only stats). With the Logs and Entities
  tabs it surfaces internals (addresses, handlers, counts) — gate it with a
  Traefik auth middleware (see the commented label in `docker-compose.yml`).
- The Docker socket is mounted **read-only**; for stricter setups, front it with a
  socket-proxy that only exposes the `logs` endpoint.
- `dash_ro` is **read-only**; never give the dashboard the superuser credentials.
- The Next standalone server (Docker) reads env from the process, not `.env`
  files — values are passed via `docker-compose` `env_file` (already wired).
