"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function LiveChart({
  data,
  dataKey,
  color = "#8b6cff",
  unit = "",
}: {
  data: { t: number; v: number }[];
  dataKey: string;
  color?: string;
  unit?: string;
}) {
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            contentStyle={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
            labelFormatter={() => ""}
            formatter={(value) => [`${Math.round(Number(value)).toLocaleString()} ${unit}`, ""]}
          />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
