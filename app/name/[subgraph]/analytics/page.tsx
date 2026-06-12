"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSubgraph } from "@/lib/use-subgraph";
import { SeriesChart } from "@/components/SeriesChart";

interface Sample {
  ts: number;
  chainHead: number;
  latestBlock: number;
  entityCount: number;
  blocksProcessed: number | null;
}

const POLL_MS = 20000;

function Panel({
  title,
  data,
  color,
  unit,
  id,
}: {
  title: string;
  data: { t: number; v: number }[];
  color: string;
  unit: string;
  id: string;
}) {
  return (
    <div className="card">
      <div className="label mb-2">{title}</div>
      {data.length > 1 ? (
        <SeriesChart data={data} color={color} unit={unit} id={id} height={200} />
      ) : (
        <div className="flex h-[200px] items-center justify-center text-sm text-white/40">collecting…</div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { subgraph } = useSubgraph();
  const [samples, setSamples] = useState<Sample[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!subgraph) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/series?subgraph=${encodeURIComponent(subgraph)}`, { cache: "no-store" });
        const data = await res.json();
        if (alive && data.ok) setSamples(data.samples ?? []);
      } catch {
        /* ignore */
      }
    };
    tick();
    timer.current = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [subgraph]);

  const chainHead = useMemo(() => samples.map((s) => ({ t: s.ts, v: s.chainHead })), [samples]);
  const entityCount = useMemo(() => samples.map((s) => ({ t: s.ts, v: s.entityCount })), [samples]);
  const indexingSpeed = useMemo(() => {
    const out: { t: number; v: number }[] = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      if (a.blocksProcessed == null || b.blocksProcessed == null) continue;
      const dt = (b.ts - a.ts) / 1000;
      if (dt <= 0) continue;
      out.push({ t: b.ts, v: Math.max((b.blocksProcessed - a.blocksProcessed) / dt, 0) });
    }
    return out;
  }, [samples]);

  return (
    <>
      <p className="mb-4 text-xs text-white/40">
        Sampled every {POLL_MS / 1000}s while this tab is open; history is kept in memory on the server.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="chain head (block)" data={chainHead} color="#eab308" unit="" id="head" />
        <Panel title="entity count" data={entityCount} color="#38bdf8" unit="entities" id="ent" />
        <Panel title="indexing speed (blocks/s)" data={indexingSpeed} color="#34d399" unit="b/s" id="spd" />
      </div>
    </>
  );
}
