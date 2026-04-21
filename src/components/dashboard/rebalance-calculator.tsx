"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { AssetWithValue, Asset, PriceMap } from "@/lib/types";

interface RebalanceResult {
  optimalBuys: {
    ticker: string;
    targetPct: number;
    sharesToBuy: number;
    cost: number;
  }[];
  optimalSpent: number;
  optimalLeftover: number;
  singleBuy: {
    ticker: string;
    targetPct: number;
    price: number;
    sharesToBuy: number;
    cost: number;
  };
  singleLeftover: number;
}

export function calculateRebalance(
  assetsWithValues: AssetWithValue[],
  totalValue: number,
  cash: number
): RebalanceResult | null {
  const allPricesAvailable = assetsWithValues.every((a) => a.price !== null);
  if (!allPricesAvailable || cash <= 0) return null;

  const newTotal = totalValue + cash;

  // Option B: Optimal (multi-asset) rebalance
  const optimalBuys = assetsWithValues.map((asset) => {
    const targetValue = newTotal * (asset.target_percentage / 100);
    const deficit = targetValue - (asset.currentValue ?? 0);
    const sharesToBuy = Math.max(0, Math.floor(deficit / asset.price!));
    const cost = sharesToBuy * asset.price!;
    return {
      ticker: asset.ticker,
      targetPct: asset.target_percentage,
      sharesToBuy,
      cost,
    };
  });

  const optimalSpent = optimalBuys.reduce((s, b) => s + b.cost, 0);
  const optimalLeftover = cash - optimalSpent;

  // Option A: Single asset (the one most under-allocated)
  const deviations = assetsWithValues.map((asset) => {
    const currentPct =
      totalValue > 0 ? ((asset.currentValue ?? 0) / totalValue) * 100 : 0;
    return { ...asset, deviation: asset.target_percentage - currentPct };
  });
  deviations.sort((a, b) => b.deviation - a.deviation);

  const best = deviations[0];
  const singleSharesToBuy = Math.floor(cash / best.price!);
  const singleCost = singleSharesToBuy * best.price!;

  return {
    optimalBuys,
    optimalSpent,
    optimalLeftover,
    singleBuy: {
      ticker: best.ticker,
      targetPct: best.target_percentage,
      price: best.price!,
      sharesToBuy: singleSharesToBuy,
      cost: singleCost,
    },
    singleLeftover: cash - singleCost,
  };
}

export function RebalanceCalculator({
  assets,
  assetsWithValues,
  totalValue,
  prices,
  cashAmount,
  setCashAmount,
  priceOverrides,
  setPriceOverrides,
}: {
  assets: Asset[];
  assetsWithValues: AssetWithValue[];
  totalValue: number;
  prices: PriceMap;
  cashAmount: string;
  setCashAmount: (v: string) => void;
  priceOverrides: Record<string, string>;
  setPriceOverrides: (v: Record<string, string>) => void;
}) {
  const result = calculateRebalance(
    assetsWithValues,
    totalValue,
    parseFloat(cashAmount) || 0
  );

  return (
    <Card className="glass border-primary/30 glow-primary">
      <CardHeader>
        <CardTitle className="text-lg">💰 Rebalance Calculator</CardTitle>
        <CardDescription>
          Enter how much cash you want to invest and optionally override prices
          with live values from your brokerage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Cash input */}
        <div className="space-y-2">
          <Label>Amount to invest (₪)</Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 5000"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            className="text-lg h-12"
          />
        </div>

        {/* Price overrides */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Price overrides (optional — enter live prices from your brokerage)
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                <span className="text-sm font-medium w-24 truncate">{asset.ticker}</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={
                    prices[asset.ticker]
                      ? `₪${prices[asset.ticker]!.toFixed(2)} (auto)`
                      : "Enter price"
                  }
                  value={priceOverrides[asset.ticker] ?? ""}
                  onChange={(e) =>
                    setPriceOverrides({ ...priceOverrides, [asset.ticker]: e.target.value })
                  }
                  className="flex-1 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Option A */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-md bg-emerald-500/20 px-2 text-xs font-semibold text-emerald-400">
                  Recommended
                </span>
                <h3 className="text-sm font-semibold">Option A: Buy Single Asset</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimizes commission — buy only the most under-allocated asset.
              </p>
              <div className="rounded-lg bg-background/50 p-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{result.singleBuy.ticker}</span>
                  <span className="ml-2 text-xs text-muted-foreground">(target: {result.singleBuy.targetPct}%)</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-400">Buy {result.singleBuy.sharesToBuy} shares</div>
                  <div className="text-xs text-muted-foreground">
                    ₪{result.singleBuy.cost.toLocaleString("en-IL", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Leftover cash: <span className="font-medium text-foreground">
                  ₪{result.singleLeftover.toLocaleString("en-IL", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Option B */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Option B: Optimal Rebalance</h3>
              <p className="text-xs text-muted-foreground">
                Spread across multiple assets for the best balance. You may pay commission on each.
              </p>
              <div className="space-y-2">
                {result.optimalBuys
                  .filter((b) => b.sharesToBuy > 0)
                  .map((buy) => (
                    <div key={buy.ticker} className="flex items-center justify-between rounded-lg bg-background/50 p-3">
                      <div>
                        <span className="font-semibold">{buy.ticker}</span>
                        <span className="ml-2 text-xs text-muted-foreground">(target: {buy.targetPct}%)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">Buy {buy.sharesToBuy} shares</div>
                        <div className="text-xs text-muted-foreground">
                          ₪{buy.cost.toLocaleString("en-IL", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Total spent: <span className="font-medium text-foreground">
                  ₪{result.optimalSpent.toLocaleString("en-IL", { minimumFractionDigits: 2 })}
                </span>{" "}
                · Leftover: <span className="font-medium text-foreground">
                  ₪{result.optimalLeftover.toLocaleString("en-IL", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
