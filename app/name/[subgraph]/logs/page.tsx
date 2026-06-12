"use client";

import { LogStream } from "@/components/LogStream";
import { useSubgraph } from "@/lib/use-subgraph";

export default function LogsPage() {
  const { s } = useSubgraph();
  return <LogStream deployment={s?.deployment} />;
}
