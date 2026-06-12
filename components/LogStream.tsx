"use client";

import { useEffect, useRef, useState } from "react";

interface LogLine {
  ts: number;
  level: string;
  message: string;
}

const LEVELS = [
  { key: "debug", label: "Debug" },
  { key: "info", label: "Info" },
  { key: "warn", label: "Warn" },
  { key: "error", label: "Error" },
];

const RANGES = [
  { key: "60", label: "Past 1 minute" },
  { key: "300", label: "Past 5 minutes" },
  { key: "900", label: "Past 15 minutes" },
  { key: "3600", label: "Past hour" },
  { key: "10800", label: "Past 3 hours" },
  { key: "21600", label: "Past 6 hours" },
  { key: "43200", label: "Past 12 hours" },
  { key: "86400", label: "Past 24 hours" },
];

// Larger windows need a bigger tail so older lines aren't truncated away
// (capped at the API's max of 5000).
const tailFor = (rangeSec: number) =>
  rangeSec >= 10800 ? 5000 : rangeSec >= 3600 ? 3000 : rangeSec >= 900 ? 1500 : 800;

const POLL_MS = 5000;

const levelStyle = (lvl: string) =>
  lvl === "crit" || lvl === "error" ? "bg-red-500/15 text-red-300"
  : lvl === "warn" ? "bg-amber-500/15 text-amber-300"
  : lvl === "info" ? "bg-white/10 text-white/60"
  : "bg-white/5 text-white/35"; // debug/trace/unknown

const hhmmss = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour12: false });

export function LogStream({ deployment }: { deployment?: string }) {
  const [level, setLevel] = useState("info");
  const [range, setRange] = useState("300");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);

  const [logs, setLogs] = useState<LogLine[]>([]);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const params = new URLSearchParams({ level, range, tail: String(tailFor(Number(range))) });
      if (deployment) params.set("deployment", deployment); // always scoped to this subgraph
      if (search.trim()) params.set("search", search.trim());
      try {
        const res = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) {
          setErr(data.error ?? "could not read logs");
          setLogs([]);
        } else {
          setErr(null);
          setLogs((data.logs as LogLine[]).slice().reverse()); // newest first
          setCount(data.count ?? 0);
        }
      } catch {
        if (alive) setErr("could not reach /api/logs");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    if (!paused) timer.current = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [level, range, search, paused, deployment]);

  return (
    <div className="card">
      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-white/70">
          <b className="text-white">{count}</b> logs
        </span>

        <label className="flex items-center gap-1.5 text-white/50">
          min level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-700 px-2 py-1 text-white outline-none focus:border-brand"
          >
            {LEVELS.map((l) => (
              <option key={l.key} value={l.key}>{l.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-white/50">
          range
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-700 px-2 py-1 text-white outline-none focus:border-brand"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </label>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search…"
          className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-ink-700 px-3 py-1 text-white outline-none placeholder:text-white/30 focus:border-brand"
        />

        <button
          onClick={() => setPaused((v) => !v)}
          className={`rounded-lg px-2.5 py-1 ${paused ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}
        >
          {paused ? "❚❚ paused" : "● live"}
        </button>
      </div>

      {/* stream */}
      {err ? (
        <div className="rounded-lg border border-red-500/30 p-3 text-sm text-red-300">{err}</div>
      ) : loading && logs.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/40">loading…</div>
      ) : logs.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/40">no logs in range</div>
      ) : (
        <div className="max-h-[70vh] divide-y divide-white/5 overflow-y-auto font-mono text-xs">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-3 py-2">
              <span className="shrink-0 text-white/30">{hhmmss(l.ts)}</span>
              <span className={`badge h-fit shrink-0 ${levelStyle(l.level)}`}>{l.level}</span>
              <span className="whitespace-pre-wrap break-words text-white/70">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
