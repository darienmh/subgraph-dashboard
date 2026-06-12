-- Read-only Postgres role for subgraph-dashboard (Entities & Details tabs).
--
-- The dashboard only ever SELECTs from graph-node's database, so it connects as
-- this dedicated role instead of the superuser. Run once per graph-node host.
--
-- Usage (change the password first):
--   docker exec -i graph-postgres psql -U graph-node -d graph-node \
--     < scripts/setup-readonly-role.sql
--
-- Then set in the dashboard .env:
--   GRAPH_PG_URL=postgresql://dash_ro:<password>@graph-postgres:5432/graph-node

-- 1. Login role. CHANGE THE PASSWORD before running.
--    DROP OWNED first so an existing role (with grants from a previous run) can
--    be dropped cleanly — plain DROP ROLE fails while privileges still depend on it.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'dash_ro') THEN
    EXECUTE 'DROP OWNED BY dash_ro';
    EXECUTE 'DROP ROLE dash_ro';
  END IF;
END $$;
CREATE ROLE dash_ro LOGIN PASSWORD 'CHANGE_ME';

-- 2. Read-only on graph-node's metadata schemas.
GRANT USAGE ON SCHEMA public TO dash_ro;
GRANT USAGE ON SCHEMA subgraphs TO dash_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dash_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA subgraphs TO dash_ro;

-- 3. Read-only on every subgraph data schema (sgd1, sgd2, …), resolved
--    dynamically so this works regardless of how many deployments exist.
DO $$
DECLARE s text;
BEGIN
  FOR s IN SELECT name FROM public.deployment_schemas LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO dash_ro', s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO dash_ro', s);
  END LOOP;
END $$;
