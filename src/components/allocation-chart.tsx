"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface AssetAllocation {
  ticker: string;
  targetPct: number;
  currentPct: number;
  priceSource?: 'manual' | 'scraped';
}

const COLORS = [
  "oklch(0.75 0.2 145)",    // green (primary)
  "oklch(0.7 0.15 200)",    // teal
  "oklch(0.75 0.18 180)",   // cyan
  "oklch(0.75 0.15 60)",    // amber
  "oklch(0.65 0.2 25)",     // red
  "oklch(0.7 0.18 250)",    // blue
  "oklch(0.7 0.18 330)",    // pink
];

export function AllocationChart({
  assets,
}: {
  assets: AssetAllocation[];
}) {
  const currentData = assets.map((a, i) => ({
    name: a.ticker,
    value: parseFloat(a.currentPct.toFixed(1)),
    color: COLORS[i % COLORS.length],
  }));

  const targetData = assets.map((a, i) => ({
    name: a.ticker,
    value: a.targetPct,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2 text-center">
          Current Allocation
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={currentData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {currentData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-lg border border-border">
                    <span className="font-medium">{d.name}</span>:{" "}
                    {d.value}%
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5">
        {assets.map((a, i) => (
          <div
            key={a.ticker}
            className="flex items-center justify-between text-xs group/legend relative"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground">{a.ticker}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  Math.abs(a.currentPct - a.targetPct) < 1
                    ? "text-emerald-400"
                    : "text-yellow-400"
                }
              >
                {a.currentPct.toFixed(1)}%
              </span>
              <span className="text-muted-foreground/60">
                / {a.targetPct}%
              </span>
            </div>
            {a.priceSource === 'manual' && (
              <div className="absolute -right-32 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary/20 border border-primary/50 rounded-none text-[8px] font-black uppercase tracking-widest text-primary whitespace-nowrap opacity-0 group-hover/legend:opacity-100 transition-opacity pointer-events-none z-50">
                Manual Override
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
