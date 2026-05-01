"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { SpicyLoadingSpinner } from "./spicy-loading-spinner";

interface AssetAllocation {
  ticker: string;
  name?: string;
  targetPct: number;
  currentPct: number;
  priceSource?: 'manual' | 'scraped';
}

const COLORS = [
  "oklch(0.75 0.2 145)",
  "oklch(0.7 0.15 200)",
  "oklch(0.75 0.18 180)",
  "oklch(0.75 0.15 60)",
  "oklch(0.65 0.2 25)",
  "oklch(0.7 0.18 250)",
  "oklch(0.7 0.18 330)",
];

export function AllocationChart({
  assets,
  isLoading = false,
}: {
  assets: AssetAllocation[];
  isLoading?: boolean;
}) {
  // Show loading spinner while data is being fetched
  if (isLoading) {
    return <SpicyLoadingSpinner />;
  }

  // Handle empty assets
  if (!assets || assets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">
        No active assets
      </div>
    );
  }

  // Sort assets by current value (most money) descending
  const sortedAssets = [...assets].sort((a, b) => b.currentPct - a.currentPct);

  const currentData = sortedAssets.map((a, i) => ({
    name: a.ticker,
    value: parseFloat(a.currentPct.toFixed(1)),
    color: COLORS[i % COLORS.length],
  }));

  const targetData = sortedAssets.map((a, i) => ({
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
                const asset = assets.find(a => a.ticker === d.name);
                const isManual = asset?.priceSource === 'manual';
                return (
                  <div className="rounded-lg px-3 py-2 text-xs shadow-2xl border" style={{ backgroundColor: '#0a0a0a', borderColor: '#333333' }}>
                    {asset?.name && asset.name !== d.name && (
                      <div className="font-black uppercase tracking-widest text-[9px] mb-1 opacity-70" style={{ color: '#ffffff' }}>
                        {asset.name}
                      </div>
                    )}
                    <div style={{ color: '#ffffff' }}>
                      <span className="font-black" style={{ color: '#00ff6b' }}>{d.name}</span>: {d.value}%
                    </div>
                    {isManual && (
                      <div className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: '#00ff6b' }}>
                        Manual Override
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5">
        {sortedAssets.map((a, i) => (
          <div
            key={a.ticker}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2" title={(a.name && a.name !== a.ticker) ? a.name : undefined}>
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground cursor-help">{a.ticker}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
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
                  <span className="text-[8px] text-primary font-black uppercase tracking-widest">manual</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
