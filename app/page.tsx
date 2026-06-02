"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n) router.push(`/name/${encodeURIComponent(n)}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5">
      <h1 className="text-2xl font-bold tracking-tight">Subgraph Dashboard</h1>
      <p className="mt-2 text-center text-sm text-white/50">
        Escribe el nombre de un subgraph para ver sus estadísticas de indexación en tiempo real.
      </p>
      <form onSubmit={go} className="mt-6 flex w-full gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nombre-del-subgraph"
          className="flex-1 rounded-xl border border-white/10 bg-ink-700 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-brand"
        />
        <button
          type="submit"
          className="rounded-xl bg-brand px-5 py-3 font-medium text-white transition hover:bg-brand-soft"
        >
          Ver
        </button>
      </form>
      <p className="mt-4 font-mono text-xs text-white/30">/name/&lt;subgraph&gt;</p>
    </main>
  );
}
