"use client";

import React from "react";
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
  if (cash <= 0) return null;

  const newTotal = totalValue + cash;

  let remainingCash = cash;
  const optimalBuys = assetsWithValues.map(asset => ({
    ticker: asset.ticker,
    targetPct: asset.target_percentage,
    sharesToBuy: 0,
    cost: 0,
    price: asset.price ?? (asset.shares_owned > 0 ? (asset.currentValue || 0) / asset.shares_owned : 0)
  }));

  let madePurchase = true;
  while (madePurchase && remainingCash > 0) {
    madePurchase = false;
    
    // Find the asset that is currently most under its target value
    let mostUnder: any = null;
    let maxDeficit = -Infinity;

    for (const buy of optimalBuys) {
      if (buy.price <= 0 || buy.price > remainingCash) continue;

      const currentVal = (assetsWithValues.find(a => a.ticker === buy.ticker)?.currentValue || 0) + buy.cost;
      const targetVal = (totalValue + cash) * (buy.targetPct / 100);
      const deficit = targetVal - currentVal;

      if (deficit > maxDeficit && deficit >= buy.price) {
        maxDeficit = deficit;
        mostUnder = buy;
      }
    }

    if (mostUnder) {
      mostUnder.sharesToBuy += 1;
      mostUnder.cost += mostUnder.price;
      remainingCash -= mostUnder.price;
      madePurchase = true;
    }
  }

  const optimalSpent = cash - remainingCash;
  const optimalLeftover = remainingCash;

  const deviations = assetsWithValues.map((asset) => {
    const currentPct =
      totalValue > 0 ? ((asset.currentValue ?? 0) / totalValue) * 100 : 0;
    return { ...asset, deviation: asset.target_percentage - currentPct };
  });
  deviations.sort((a, b) => b.deviation - a.deviation);

  const best = deviations[0];
  let bestPrice = best.price;
  if (bestPrice === null && best.shares_owned > 0 && (best.currentValue || 0) > 0) {
    bestPrice = (best.currentValue || 0) / best.shares_owned;
  }

  const singleSharesToBuy = bestPrice ? Math.floor(cash / bestPrice) : 0;
  const singleCost = bestPrice ? singleSharesToBuy * bestPrice : cash;

  return {
    optimalBuys: optimalBuys as any,
    optimalSpent,
    optimalLeftover,
    singleBuy: {
      ticker: best.ticker,
      targetPct: best.target_percentage,
      price: bestPrice || 0,
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
  names,
  cashAmount,
  setCashAmount,
  priceOverrides,
  setPriceOverrides,
  excludedAssets = new Set(),
  onExcludedAssetsChange,
  onRefreshPrices,
  isRefreshing = false,
}: {
  assets: Asset[];
  assetsWithValues: AssetWithValue[];
  totalValue: number;
  prices: PriceMap;
  names: Record<string, string>;
  cashAmount: string;
  setCashAmount: (v: string) => void;
  priceOverrides: Record<string, string>;
  setPriceOverrides: (v: Record<string, string>) => void;
  excludedAssets?: Set<string>;
  onExcludedAssetsChange?: (excluded: Set<string>) => void;
  onRefreshPrices?: () => void;
  isRefreshing?: boolean;
}) {
  const [expandedOption, setExpandedOption] = React.useState<'A' | 'B' | null>(null);
  const cashInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setTimeout(() => cashInputRef.current?.focus(), 100);
  }, []);

  const effectiveAssetsWithValues = assetsWithValues.map(a => {
    const override = priceOverrides[a.ticker];
    if (override && parseFloat(override) > 0) {
      const manualValue = parseFloat(override);
      return { ...a, currentValue: manualValue };
    }
    return a;
  });

  // Filter out excluded assets for calculation
  const includedAssetsWithValues = effectiveAssetsWithValues.filter(a => !excludedAssets.has(a.ticker));

  const effectiveTotalValue = includedAssetsWithValues.reduce((sum, a) => sum + (a.currentValue ?? 0), 0);

  const result = calculateRebalance(
    includedAssetsWithValues,
    effectiveTotalValue,
    parseFloat(cashAmount) || 0
  );

  return (
    <div className="grid gap-6 mobile:gap-12 lg:grid-cols-[1fr_450px] h-full overflow-hidden">
      <div className="flex flex-col min-h-0 space-y-6 mobile:space-y-8 overflow-hidden">
        <div className="flex-shrink-0 space-y-3 mobile:space-y-4 p-4 mobile:p-8 bg-primary/5 border-l-4 border-primary">
          <Label className="text-xs mobile:text-sm uppercase tracking-[0.2em] mobile:tracking-[0.3em] font-black text-primary font-heading">01. Capital Injection (₪)</Label>
          <Input
            ref={cashInputRef}
            placeholder="5,000"
            value={cashAmount ? Number(cashAmount).toLocaleString() : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, "");
              if (raw === "" || !isNaN(Number(raw))) {
                setCashAmount(raw);
              }
            }}
            className="text-2xl mobile:text-4xl h-16 mobile:h-20 bg-background/50 border-white/20 focus:border-primary rounded-none font-black text-glow"
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          <div className="flex flex-col gap-1 px-1">
            <Label className="text-sm uppercase tracking-[0.3em] font-black font-heading">02. Manual Valuations</Label>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
              Override position values for technical precision.
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 bg-white/[0.02]">
            <div className="divide-y divide-white/5">
              {assets.map((asset) => (
                <div key={asset.id} className="grid grid-cols-[1fr_110px_45px] mobile:grid-cols-[1fr_160px_50px] items-center gap-2 mobile:gap-6 p-3 mobile:p-6 hover:bg-primary/[0.03] transition-all">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] mobile:text-sm font-black uppercase tracking-tight truncate">{asset.ticker}</span>
                    <span className="text-[8px] mobile:text-[10px] text-muted-foreground uppercase font-black tracking-widest truncate opacity-50">{names[asset.ticker] || "NO METADATA"}</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder={
                        prices[asset.ticker]
                          ? `${(asset.shares_owned * prices[asset.ticker]!).toLocaleString()}`
                          : "0"
                      }
                      value={priceOverrides[asset.ticker] ? Number(priceOverrides[asset.ticker]).toLocaleString() : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, "");
                        if (raw === "" || !isNaN(Number(raw))) {
                          setPriceOverrides({ ...priceOverrides, [asset.ticker]: raw });
                        }
                      }}
                      className="h-10 mobile:h-12 bg-white/5 text-right pr-2 mobile:pr-4 text-[10px] mobile:text-xs rounded-none border-white/20 focus:border-primary/50 font-mono font-black"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary uppercase">₪</div>
                    {(asset as any).priceSource === 'manual' && (
                      <div className="absolute -top-8 right-0 px-2 py-1 bg-primary/20 border border-primary/50 rounded-none text-[8px] font-black uppercase tracking-widest text-primary whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-50">
                        Manual
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const newExcluded = new Set(excludedAssets);
                      if (newExcluded.has(asset.ticker)) {
                        newExcluded.delete(asset.ticker);
                      } else {
                        newExcluded.add(asset.ticker);
                      }
                      onExcludedAssetsChange?.(newExcluded);
                    }}
                    className={`h-10 mobile:h-12 rounded-none border font-black text-[8px] mobile:text-[10px] uppercase tracking-widest transition-all cursor-pointer ${
                      excludedAssets.has(asset.ticker)
                        ? 'bg-destructive/20 border-destructive/50 text-destructive'
                        : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                    }`}
                  >
                    {excludedAssets.has(asset.ticker) ? 'OFF' : 'ON'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col min-h-0 space-y-6 overflow-hidden">
        <div className="flex flex-col gap-1 px-1">
          <Label className="text-sm uppercase tracking-[0.3em] font-black font-heading">03. Execution Plan</Label>
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
            Automated allocation strategies.
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
          {!result && (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-white/10 p-12 text-center rounded-none bg-white/[0.01]">
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] leading-loose opacity-40">
                Awaiting System Input<br/>Define capital to generate rebalance.
              </p>
            </div>
          )}

          {result && (
            <>
              {result.singleBuy.sharesToBuy === 0 && result.optimalBuys.every(b => b.sharesToBuy === 0) ? (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-destructive/30 p-8 mobile:p-12 text-center rounded-none bg-destructive/5">
                  <p className="text-[10px] mobile:text-[10px] text-destructive uppercase font-black tracking-[0.2em] mobile:tracking-[0.3em] leading-loose">
                    Insufficient Capital<br/>Available funds cannot purchase any assets at current prices.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 mobile:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Option A */}
              <div className="bg-white/40 dark:bg-white/5 border border-white/30 dark:border-white/20 p-4 mobile:p-8 space-y-4 mobile:space-y-6 relative overflow-hidden group">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 mobile:gap-4">
                    <div className="h-6 mobile:h-8 w-1 bg-white dark:bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                    <h3 className="text-xs mobile:text-sm font-black uppercase tracking-[0.2em] mobile:tracking-[0.3em] font-heading">Single Asset Entry</h3>
                  </div>
                  <button
                    onClick={() => setExpandedOption(expandedOption === 'A' ? null : 'A')}
                    className="rounded-none h-8 mobile:h-10 px-2 mobile:px-4 text-[8px] mobile:text-[10px] font-black uppercase tracking-widest bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 border border-white/40 dark:border-white/30 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {expandedOption === 'A' ? 'HIDE' : 'VIEW'} ALLOCATION
                  </button>
                </div>
                
                <div className="bg-background border border-white/40 dark:border-white/30 p-4 mobile:p-6 flex items-center justify-between shadow-xl">
                  <div>
                    <div className="font-black text-base mobile:text-lg uppercase text-glow">{result.singleBuy.ticker}</div>
                    <div className="text-[9px] mobile:text-[10px] text-muted-foreground font-black tracking-widest uppercase opacity-60">TARGET: {result.singleBuy.targetPct.toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-black dark:text-white text-base mobile:text-lg uppercase">
                      {result.singleBuy.sharesToBuy > 0 
                        ? `+${result.singleBuy.sharesToBuy} UNITS` 
                        : `+₪${result.singleBuy.cost.toLocaleString()}`}
                    </div>
                    <div className="text-[9px] mobile:text-[10px] text-muted-foreground font-black font-mono">
                      Σ ₪{result.singleBuy.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {expandedOption === 'A' && (
                  <div className="bg-white/20 dark:bg-white/[0.02] border border-white/30 dark:border-white/10 p-4 mobile:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Post-Investment Allocation:</div>
                    <div className="space-y-2">
                      {effectiveAssetsWithValues.map((asset) => {
                        const newValue = (asset.currentValue || 0) + (asset.ticker === result.singleBuy.ticker ? result.singleBuy.cost : 0);
                        const newTotal = effectiveTotalValue + result.singleBuy.cost;
                        const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
                        const isInvested = asset.ticker === result.singleBuy.ticker;
                        return (
                          <div 
                            key={asset.ticker} 
                            className={`flex items-center justify-between text-[10px] p-3 rounded-none transition-all ${
                              isInvested 
                                ? 'bg-white/40 dark:bg-white/20 border border-white/50 dark:border-white/40 font-black' 
                                : 'bg-transparent'
                            }`}
                          >
                            <span className="font-black uppercase">{asset.ticker}</span>
                            <span className={`font-mono ${isInvested ? 'text-black dark:text-white' : 'text-muted-foreground'}`}>{newPct.toFixed(2)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-white/20 dark:border-white/10 pt-4">
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Leftover Cash:</span>
                  <span className="text-sm font-black font-mono text-black dark:text-white">
                    ₪{result.singleLeftover.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Option B */}
              {(() => {
                const activeOptimal = result.optimalBuys.filter(b => b.cost > 0);
                const isSameAsA = activeOptimal.length === 1 && activeOptimal[0].ticker === result.singleBuy.ticker && activeOptimal[0].sharesToBuy === result.singleBuy.sharesToBuy;
                
                if (isSameAsA) return null;

                return (
                  <div className="bg-primary/5 border border-primary/20 p-4 mobile:p-8 space-y-4 mobile:space-y-6 relative overflow-hidden group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 mobile:gap-4">
                        <div className="h-6 mobile:h-8 w-1 bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                        <h3 className="text-xs mobile:text-sm font-black uppercase tracking-[0.2em] mobile:tracking-[0.3em] font-heading">Optimal Balance Strategy</h3>
                      </div>
                      <button
                        onClick={() => setExpandedOption(expandedOption === 'B' ? null : 'B')}
                        className="rounded-none h-8 mobile:h-10 px-2 mobile:px-4 text-[8px] mobile:text-[10px] font-black uppercase tracking-widest bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {expandedOption === 'B' ? 'HIDE' : 'VIEW'} ALLOCATION
                      </button>
                    </div>
                    <div className="space-y-px bg-white/5 border border-white/10 shadow-xl overflow-hidden">
                      {activeOptimal.map((buy: any) => (
                        <div key={buy.ticker} className="flex items-center justify-between bg-background p-4 mobile:p-6 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <div>
                            <div className="font-black text-xs mobile:text-sm uppercase text-glow">{buy.ticker}</div>
                            <div className="text-[8px] mobile:text-[9px] text-muted-foreground font-black tracking-widest uppercase opacity-60">TARGET: {buy.targetPct.toFixed(1)}%</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-primary text-xs mobile:text-sm uppercase">
                              {buy.sharesToBuy > 0 
                                ? `+${buy.sharesToBuy} UNITS` 
                                : `+₪${buy.cost.toLocaleString()}`}
                            </div>
                            <div className="text-[8px] mobile:text-[9px] text-muted-foreground font-black font-mono">
                              ₪{buy.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 space-y-3 border-t border-primary/10">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Total Invested:</span>
                        <span className="text-sm font-black font-mono text-primary">₪{result.optimalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Leftover Cash:</span>
                        <span className="text-sm font-black font-mono text-primary">₪{result.optimalLeftover.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {expandedOption === 'B' && (
                      <div className="bg-white/[0.02] border border-primary/10 p-4 mobile:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Post-Investment Allocation:</div>
                        <div className="space-y-2">
                          {effectiveAssetsWithValues.map((asset) => {
                            const buyForThisAsset = result.optimalBuys.find(b => b.ticker === asset.ticker);
                            const newValue = (asset.currentValue || 0) + (buyForThisAsset?.cost || 0);
                            const newTotal = effectiveTotalValue + result.optimalSpent;
                            const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
                            const isInvested = (buyForThisAsset?.cost || 0) > 0;
                            return (
                              <div 
                                key={asset.ticker} 
                                className={`flex items-center justify-between text-[10px] p-3 rounded-none transition-all ${
                                  isInvested 
                                    ? 'bg-primary/20 border border-primary/40 font-black' 
                                    : 'bg-transparent'
                                }`}
                              >
                                <span className="font-black uppercase">{asset.ticker}</span>
                                <span className={`font-mono ${isInvested ? 'text-primary' : 'text-muted-foreground'}`}>{newPct.toFixed(2)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
