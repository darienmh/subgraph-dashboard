"use client";

import { EntitiesTable } from "@/components/EntitiesTable";
import { useSubgraph } from "@/lib/use-subgraph";

export default function EntitiesPage() {
  const { s } = useSubgraph();
  return <EntitiesTable deployment={s?.deployment} />;
}
