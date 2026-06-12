"use client";

import { useParams } from "next/navigation";
import { SubgraphProvider } from "@/lib/use-subgraph";
import { Header } from "@/components/Header";
import { Tabs } from "@/components/Tabs";

export default function SubgraphLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const subgraph = decodeURIComponent(String(params.subgraph ?? ""));

  return (
    <SubgraphProvider subgraph={subgraph}>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Header />
        <Tabs subgraph={subgraph} />
        {children}
      </main>
    </SubgraphProvider>
  );
}
