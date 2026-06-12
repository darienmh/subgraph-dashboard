"use client";

import { useState } from "react";
import { apiPath } from "@/lib/api-path";

const DEFAULT_QUERY = `{
  _meta {
    block { number }
    hasIndexingErrors
  }
}`;

export function Playground({ deployment }: { deployment?: string }) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [vars, setVars] = useState("");
  const [result, setResult] = useState<string>("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!deployment) {
      setResult("// no deployment resolved yet");
      return;
    }
    let variables: unknown = undefined;
    if (vars.trim()) {
      try {
        variables = JSON.parse(vars);
      } catch {
        setResult("// variables must be valid JSON");
        return;
      }
    }
    setRunning(true);
    try {
      const res = await fetch(apiPath("/api/query"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables, deployment }),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setResult("// request failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">playground</div>
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-soft disabled:opacity-50"
        >
          {running ? "running…" : "▶ run"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            className="h-64 w-full resize-none rounded-lg border border-white/10 bg-ink-700 p-3 font-mono text-xs text-white outline-none focus:border-brand"
          />
          <textarea
            value={vars}
            onChange={(e) => setVars(e.target.value)}
            spellCheck={false}
            placeholder='variables (JSON, optional) e.g. { "first": 5 }'
            className="h-20 w-full resize-none rounded-lg border border-white/10 bg-ink-700 p-3 font-mono text-xs text-white outline-none placeholder:text-white/30 focus:border-brand"
          />
        </div>
        <pre className="h-[22rem] overflow-auto rounded-lg border border-white/10 bg-ink-900/60 p-3 font-mono text-xs text-white/70">
          {result || "// run a query to see the result"}
        </pre>
      </div>
    </div>
  );
}
