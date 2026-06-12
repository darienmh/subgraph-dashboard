"use client";

import { useEffect, useMemo, useState } from "react";
import { apiPath } from "@/lib/api-path";

interface Entity {
  name: string;
  count: number;
  cols: number;
}

type SortKey = "name" | "count" | "cols";

const fmt = (n: number) => n.toLocaleString("en-US");

export function EntitiesTable({ deployment }: { deployment?: string }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [schema, setSchema] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "count", dir: -1 });

  useEffect(() => {
    if (!deployment) return;
    let alive = true;
    setLoading(true);
    fetch(apiPath(`/api/entities?deployment=${encodeURIComponent(deployment)}`), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.ok) {
          setErr(d.error ?? "could not load entities");
          setEntities([]);
        } else {
          setErr(null);
          setEntities(d.entities ?? []);
          setSchema(d.schema ?? null);
          setTotalRows(d.totalRows ?? 0);
        }
      })
      .catch(() => alive && setErr("could not reach /api/entities"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [deployment]);

  const sorted = useMemo(() => {
    const arr = [...entities];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string") return av.localeCompare(bv as string) * sort.dir;
      return ((av as number) - (bv as number)) * sort.dir;
    });
    return arr;
  }, [entities, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-white/70"><b className="text-white">{fmt(entities.length)}</b> entities</span>
        <span className="text-white/50"><b className="text-white/80">{fmt(totalRows)}</b> rows total</span>
        {schema && <span className="font-mono text-xs text-white/40">schema {schema}</span>}
      </div>

      {err ? (
        <div className="rounded-lg border border-red-500/30 p-3 text-sm text-red-300">{err}</div>
      ) : loading ? (
        <div className="py-10 text-center text-sm text-white/40">loading…</div>
      ) : entities.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/40">no entities</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/40">
                <th className="cursor-pointer py-2 pr-4 font-medium uppercase tracking-wider hover:text-white/70" onClick={() => toggle("name")}>
                  name{arrow("name")}
                </th>
                <th className="cursor-pointer py-2 pr-4 text-right font-medium uppercase tracking-wider hover:text-white/70" onClick={() => toggle("count")}>
                  count{arrow("count")}
                </th>
                <th className="cursor-pointer py-2 text-right font-medium uppercase tracking-wider hover:text-white/70" onClick={() => toggle("cols")}>
                  columns{arrow("cols")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorted.map((e) => (
                <tr key={e.name} className="hover:bg-white/[0.02]">
                  <td className="py-2 pr-4 font-mono text-white/80">{e.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-white">{fmt(e.count)}</td>
                  <td className="py-2 text-right tabular-nums text-white/50">{e.cols}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
