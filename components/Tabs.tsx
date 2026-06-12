"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// `ready: false` tabs are placeholders for upcoming phases (Logs, Entities, …).
// They render disabled until their route exists.
const TABS: { key: string; label: string; ready: boolean }[] = [
  { key: "", label: "Overview", ready: true },
  { key: "logs", label: "Logs", ready: true },
  { key: "entities", label: "Entities", ready: true },
  { key: "analytics", label: "Analytics", ready: true },
  { key: "endpoints", label: "Endpoints", ready: true },
  { key: "details", label: "Details", ready: true },
];

export function Tabs({ subgraph }: { subgraph: string }) {
  const pathname = usePathname();
  const base = `/name/${encodeURIComponent(subgraph)}`;

  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b border-white/5">
      {TABS.map((t) => {
        const href = t.key ? `${base}/${t.key}` : base;
        const active = pathname === href;
        const cls = "relative px-3 py-2 text-sm transition-colors";

        if (!t.ready) {
          return (
            <span key={t.label} className={`${cls} cursor-not-allowed text-white/25`} title="coming soon">
              {t.label}
            </span>
          );
        }
        return (
          <Link
            key={t.label}
            href={href}
            className={`${cls} ${active ? "text-white" : "text-white/50 hover:text-white/80"}`}
          >
            {t.label}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}
