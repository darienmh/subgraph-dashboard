import http from "node:http";

// Where to reach the Docker Engine API:
//  - prod:  unix socket path (default), e.g. /var/run/docker.sock (mounted :ro)
//  - dev:   a TCP URL tunneled over SSH, e.g. http://localhost:2376
const DOCKER = process.env.DOCKER_HOST || "/var/run/docker.sock";
export const GRAPH_CONTAINER = process.env.GRAPH_CONTAINER || "graph-node";

function dockerGet(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const isTcp = DOCKER.startsWith("http://") || DOCKER.startsWith("tcp://");
    const opts: http.RequestOptions = isTcp
      ? (() => {
          const u = new URL(DOCKER.replace(/^tcp:\/\//, "http://"));
          return { host: u.hostname, port: u.port || 2375, path };
        })()
      : { socketPath: DOCKER, path };

    const req = http.request({ ...opts, method: "GET", timeout: 10000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("docker request timeout")));
    req.end();
  });
}

/**
 * Demultiplex Docker's log stream. Non-TTY containers prefix each frame with an
 * 8-byte header [stream(1), 0,0,0, size(4) big-endian]; TTY containers send raw
 * text. We detect the header shape and fall back to plain text otherwise.
 */
function demux(buf: Buffer): string {
  let out = "";
  let off = 0;
  let looksFramed = false;
  while (off + 8 <= buf.length) {
    const stream = buf[off];
    const size = buf.readUInt32BE(off + 4);
    // valid frame: stream type 0/1/2 and a size that fits
    if ((stream === 0 || stream === 1 || stream === 2) && off + 8 + size <= buf.length) {
      out += buf.toString("utf8", off + 8, off + 8 + size);
      off += 8 + size;
      looksFramed = true;
    } else {
      break;
    }
  }
  return looksFramed ? out : buf.toString("utf8");
}

export interface LogLine {
  ts: number; // epoch ms
  level: string; // trace|debug|info|warn|error|crit|unknown
  message: string;
  raw: string;
}

const LEVEL_MAP: Record<string, string> = {
  TRCE: "trace", TRACE: "trace",
  DEBG: "debug", DEBUG: "debug",
  INFO: "info",
  WARN: "warn", WARNING: "warn",
  ERRO: "error", ERROR: "error",
  CRIT: "crit",
};

const LINE_RE = /^(\S+)\s+(.*)$/; // <iso-ts> <rest>
const LEVEL_RE = /\b(TRCE|TRACE|DEBG|DEBUG|INFO|WARN|WARNING|ERRO|ERROR|CRIT)\b/;

function parseLine(line: string): LogLine | null {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const [, isoTs, rest] = m;
  const t = Date.parse(isoTs);
  const ts = Number.isFinite(t) ? t : Date.now();
  const lvlMatch = LEVEL_RE.exec(rest);
  const level = lvlMatch ? LEVEL_MAP[lvlMatch[1].toUpperCase()] ?? "info" : "unknown";
  // message = everything after the level token (or the whole rest if none)
  const message = lvlMatch ? rest.slice((lvlMatch.index ?? 0) + lvlMatch[1].length).trim() : rest.trim();
  return { ts, level, message, raw: rest };
}

export interface FetchLogsOpts {
  tail?: number; // last N lines
  sinceSec?: number; // only logs newer than now - sinceSec
  container?: string;
}

/** Fetch + parse recent logs from a container. Newest last. */
export async function fetchLogs(opts: FetchLogsOpts = {}): Promise<LogLine[]> {
  const container = opts.container || GRAPH_CONTAINER;
  const tail = Math.min(Math.max(opts.tail ?? 300, 1), 5000);
  const params = new URLSearchParams({ stdout: "1", stderr: "1", timestamps: "1", tail: String(tail) });
  if (opts.sinceSec && opts.sinceSec > 0) {
    params.set("since", String(Math.floor(Date.now() / 1000) - opts.sinceSec));
  }
  const buf = await dockerGet(`/containers/${encodeURIComponent(container)}/logs?${params.toString()}`);
  const text = demux(buf);

  const lines: LogLine[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const parsed = parseLine(raw);
    if (parsed) lines.push(parsed);
    else if (lines.length) lines[lines.length - 1].message += "\n" + raw; // continuation (e.g. stack trace)
  }
  return lines;
}
