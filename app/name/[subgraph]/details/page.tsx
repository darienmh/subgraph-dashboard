"use client";

import { useEffect, useState } from "react";
import { useSubgraph } from "@/lib/use-subgraph";

interface Details {
  ok: boolean;
  error?: string;
  versionId?: string | null;
  deployedAt?: string | null;
  schema?: string | null;
  shard?: string | null;
  network?: string | null;
  specVersion?: string | null;
  features?: string[];
  startBlock?: number | null;
}

const fmt = (n?: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 py-2.5">
      <span className="label">{label}</span>
      <span className={`text-sm text-white/80 ${mono ? "break-all font-mono text-xs" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

export default function DetailsPage() {
  const { s } = useSubgraph();
  const deployment = s?.deployment;
  const [d, setD] = useState<Details | null>(null);

  useEffect(() => {
    if (!deployment) return;
    let alive = true;
    fetch(`/api/details?deployment=${encodeURIComponent(deployment)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => alive && setD(data))
      .catch(() => alive && setD({ ok: false, error: "could not reach /api/details" }));
    return () => {
      alive = false;
    };
  }, [deployment]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card">
        <div className="label mb-3">deployment</div>
        <Row label="deployment id" value={s?.deployment} mono />
        <Row label="internal version" value={d?.versionId} mono />
        <Row label="deployed" value={d?.deployedAt ? d.deployedAt.replace("T", " ").slice(0, 19) : "—"} />
        <Row label="node" value={s?.node} />
        <Row label="spec version" value={d?.specVersion} />
        <Row label="features" value={d?.features?.length ? d.features.join(", ") : "—"} />
      </div>

      <div className="card">
        <div className="label mb-3">chain & storage</div>
        <Row label="network" value={s?.network ?? d?.network} />
        <Row label="shard" value={d?.shard} />
        <Row label="schema" value={d?.schema} mono />
        <Row label="start block" value={fmt(d?.startBlock)} />
        <Row label="earliest block" value={fmt(s?.earliestBlock)} />
        <Row label="latest block" value={fmt(s?.latestBlock)} />
        <Row label="chain head" value={fmt(s?.chainHead)} />
        <Row label="entities" value={fmt(s?.entityCount)} />
      </div>

      {d && !d.ok && (
        <div className="card border-amber-500/30 text-amber-300 md:col-span-2">
          {d.error ?? "Postgres metadata unavailable"} — deployment id + chain data above still come from index-status.
        </div>
      )}
    </div>
  );
}
