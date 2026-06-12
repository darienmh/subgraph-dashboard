"use client";

import { useSubgraph } from "@/lib/use-subgraph";
import { Playground } from "@/components/Playground";

export default function EndpointsPage() {
  const { s, subgraph } = useSubgraph();
  const dep = s?.deployment ?? "<deployment-id>";
  const path = `/subgraphs/id/${dep}`;

  const curl = `curl -X POST https://<your-graph-host>${path} \\
  -H 'content-type: application/json' \\
  -H 'X-Api-Key: <your-api-key>' \\
  -d '{"query":"{ _meta { block { number } } }"}'`;

  const js = `const res = await fetch("https://<your-graph-host>${path}", {
  method: "POST",
  headers: { "content-type": "application/json", "X-Api-Key": "<your-api-key>" },
  body: JSON.stringify({ query: "{ _meta { block { number } } }" }),
});
const { data } = await res.json();`;

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="label mb-3">query endpoint</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 py-2">
          <span className="label">by deployment</span>
          <span className="break-all font-mono text-xs text-white/80">{path}</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 py-2">
          <span className="label">by name</span>
          <span className="break-all font-mono text-xs text-white/80">/subgraphs/name/{subgraph}</span>
        </div>
        <p className="mt-3 text-xs text-white/40">
          Public endpoints sit behind your gateway (Traefik + API key). Replace{" "}
          <span className="font-mono">&lt;your-graph-host&gt;</span> and{" "}
          <span className="font-mono">&lt;your-api-key&gt;</span> with your own.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="label mb-2">cURL</div>
          <pre className="overflow-auto rounded-lg bg-ink-900/60 p-3 font-mono text-xs text-white/70">{curl}</pre>
        </div>
        <div className="card">
          <div className="label mb-2">JavaScript (fetch)</div>
          <pre className="overflow-auto rounded-lg bg-ink-900/60 p-3 font-mono text-xs text-white/70">{js}</pre>
        </div>
      </div>

      <Playground deployment={s?.deployment} />
    </div>
  );
}
