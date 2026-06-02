# Subgraph Dashboard

Real-time indexing dashboard for a self-hosted **graph-node** subgraph (Next.js).
It reads two graph-node endpoints server-side and serves clean JSON to the UI:

- **index-status GraphQL** (`:8030`) → sync %, health, entity count, errors.
- **Prometheus metrics** (`:8040`) → indexing speed, query rate, RPC latency, Postgres pool.

A Next API route (`/api/stats`) does the scraping (no CORS, no public metrics exposure)
and computes per-second rates between polls. The UI polls it every 3s.

## Local development

```bash
cp .env.example .env.local
npm install
```

The status endpoint is public, but metrics (`:8040`) are not — open an SSH tunnel:

```bash
ssh -i ~/.ssh/hetzner -N -L 8040:localhost:8040 root@5.78.230.148
```

Then set in `.env.local`:

```
GRAPH_STATUS_URL=https://graph-status.samyca.com/graphql
GRAPH_METRICS_URL=http://localhost:8040/metrics
SUBGRAPH_NAME=gmix-operations-prod
```

```bash
npm run dev      # http://localhost:3009
```

Without the tunnel it still runs: sync / entities / health work; the rate panels show "—".

## Deploy (srv5, behind Traefik)

The container joins graph-node's internal Docker network, so it reaches
`graph-node:8030` / `graph-node:8040` directly — metrics never leave the host.

```bash
# on the server, in /opt/subgraph-dashboard
docker compose build
docker compose up -d
```

DNS: add `gmix-dash.samyca.com → 5.78.230.148` (proxied) in Cloudflare. Served over the
`*.samyca.com` wildcard TLS. The UI is public by default (read-only stats); to gate it,
add a Traefik auth middleware to the router (see the commented label in `docker-compose.yml`).

## Notes

- `velocidad` (blocks/s) comes from `rate(deployment_blocks_processed_count)` — it reflects
  the true scan speed even when the displayed `latestBlock` lags (sparse-event subgraphs).
- Want the exact scan frontier from logs instead? Use `monitor-sync.sh` in the subgraph repo.
