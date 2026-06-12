import { NextResponse } from "next/server";
import { fetchLogs } from "@/lib/docker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER = ["trace", "debug", "info", "warn", "error", "crit"];
const rank = (lvl: string) => {
  const i = ORDER.indexOf(lvl);
  return i === -1 ? 2 : i; // unknown treated as info-ish
};

export async function GET(req: Request) {
  const now = Date.now();
  const url = new URL(req.url);
  const minLevel = (url.searchParams.get("level") || "info").toLowerCase();
  const range = Number(url.searchParams.get("range") || "300"); // seconds; 0 = no limit
  const tail = Number(url.searchParams.get("tail") || "500");
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const deployment = url.searchParams.get("deployment") || "";
  const container = url.searchParams.get("container") || undefined;

  let lines;
  try {
    lines = await fetchLogs({ tail, sinceSec: range > 0 ? range : undefined, container });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        ts: now,
        error:
          "couldn't read container logs — is the Docker socket reachable? " +
          "(dev: tunnel it to DOCKER_HOST; prod: mount /var/run/docker.sock:ro)",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 200 },
    );
  }

  const minRank = rank(minLevel);
  const logs = lines
    .filter((l) => rank(l.level) >= minRank)
    .filter((l) => (deployment ? l.message.includes(deployment) || l.raw.includes(deployment) : true))
    .filter((l) => (search ? l.message.toLowerCase().includes(search) : true));

  return NextResponse.json({ ok: true, ts: now, count: logs.length, level: minLevel, logs });
}
