"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 }) : String(Math.round(n));

const hhmm = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export function SeriesChart({
  data,
  color = "#8b6cff",
  unit = "",
  height = 200,
  id,
}: {
  data: { t: number; v: number }[];
  color?: string;
  unit?: string;
  height?: number;
  id: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tickFormatter={hhmm}
            minTickGap={48}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={44}
            tickFormatter={compact}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString("en-US", { hour12: false })}
            formatter={(value) => [`${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`, ""]}
          />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#g-${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
