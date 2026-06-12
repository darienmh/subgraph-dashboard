// Minimal Prometheus text-format parser — enough for graph-node's /metrics.

export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export function parsePrometheus(text: string): Sample[] {
  const out: Sample[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)/);
    if (!m) continue;
    const [, name, labelStr, valStr] = m;
    const value = Number(valStr);
    if (!Number.isFinite(value)) continue;
    const labels: Record<string, string> = {};
    if (labelStr) {
      for (const part of labelStr.split(",")) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        const k = part.slice(0, eq).trim();
        let v = part.slice(eq + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        labels[k] = v.replace(/\\"/g, '"');
      }
    }
    out.push({ name, labels, value });
  }
  return out;
}

function matches(s: Sample, match?: Record<string, string>): boolean {
  if (!match) return true;
  return Object.entries(match).every(([k, v]) => s.labels[k] === v);
}

/** First value for a metric (optionally filtered by labels). */
export function findOne(samples: Sample[], name: string, match?: Record<string, string>): number | undefined {
  for (const s of samples) if (s.name === name && matches(s, match)) return s.value;
  return undefined;
}

/** Sum of all series for a metric (optionally filtered). Returns undefined if none found. */
export function sumBy(samples: Sample[], name: string, match?: Record<string, string>): number | undefined {
  let total = 0;
  let found = false;
  for (const s of samples) {
    if (s.name === name && matches(s, match)) {
      total += s.value;
      found = true;
    }
  }
  return found ? total : undefined;
}

/**
 * Cumulative average of a Prometheus histogram: `<base>_sum / <base>_count`.
 * Robust for an already-synced node (unlike per-second rates, which trend to 0):
 * it reflects the lifetime average latency. Returns undefined if absent or count 0.
 */
export function histogramAvg(samples: Sample[], base: string, match?: Record<string, string>): number | undefined {
  const sum = sumBy(samples, `${base}_sum`, match);
  const count = sumBy(samples, `${base}_count`, match);
  if (sum == null || count == null || count === 0) return undefined;
  return sum / count;
}
