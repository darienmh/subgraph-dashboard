# Subgraph Dashboard

Real-time indexing dashboard for a self-hosted **graph-node** subgraph (Next.js).
Point it at any graph-node + subgraph via env vars. It reads two endpoints
server-side and serves clean JSON to the UI:

- **index-status GraphQL** (`:8030`) → sync %, health, entity count, errors.
- **Prometheus metrics** (`:8040`) → indexing speed, query rate, RPC latency, Postgres pool.

A Next API route (`/api/stats`) does the scraping (no CORS, no public metrics exposure)
and computes per-second rates between polls. The UI polls it every 3s.

## Configuration

All values are env-driven (`.env.example` is the template):

| Var | What |
|---|---|
| `SUBGRAPH_NAME` | subgraph name as registered on graph-node |
| `GRAPH_STATUS_URL` | index-status GraphQL (`:8030`) |
| `GRAPH_METRICS_URL` | Prometheus metrics (`:8040`); empty = status-only |
| `DASH_HOST` | public hostname for the Traefik router (deploy only) |
| `GRAPH_NETWORK` | graph-node's docker network name (deploy; default `graph-node_graph`) |

## Local development

```bash
cp .env.example .env.local   # set SUBGRAPH_NAME + GRAPH_STATUS_URL
npm install
```

The metrics port (`:8040`) is not public — tunnel it for dev:

```bash
ssh -N -L 8040:localhost:8040 user@your-server
# then GRAPH_METRICS_URL=http://localhost:8040/metrics
```

```bash
npm run dev      # http://localhost:3009
```

Without metrics it still runs: sync / entities / health work; rate panels show "—".

## Deploy (behind Traefik)

The container joins graph-node's internal docker network, so it reaches
`graph-node:8030` / `graph-node:8040` directly — metrics never leave the host.

```bash
cp .env.example .env         # set SUBGRAPH_NAME, GRAPH_STATUS_URL=http://graph-node:8030/graphql,
                             # GRAPH_METRICS_URL=http://graph-node:8040/metrics, DASH_HOST=...
docker compose build
docker compose up -d
```

Add a DNS record for `DASH_HOST` → your server, behind your TLS. The UI is public by
default (read-only stats); to gate it, add a Traefik auth middleware to the router
(see the commented label in `docker-compose.yml`).

## Notes

- `velocidad` (blocks/s) comes from `rate(deployment_blocks_processed_count)` — it reflects
  the true scan speed even when the displayed `latestBlock` lags (sparse-event subgraphs).
- The Next standalone server (Docker) reads env from the process, not `.env` files — pass
  values via `docker-compose` `env_file` / `environment` (already wired).
