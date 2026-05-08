"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssetWithValue, Asset, PriceMap } from "@/lib/types";

function calculateCommission(amount: number, percentage: number, minimum: number, ticker: string): number {
  if (percentage === 0 && minimum === 0) return 0;
  
  const isIsraeliStock = /^\d+$/.test(ticker);
  if (!isIsraeliStock) return 0;
  
  return Math.max(amount * (percentage / 100), minimum);
}

interface RebalanceResult {
  optimalBuys: {
    ticker: string;
    targetPct: number;
    sharesToBuy: number;
    cost: number;
    commission: number;
  }[];
  optimalSpent: number;
  optimalCommission: number;
  optimalLeftover: number;
  singleBuy: {
    ticker: string;
    targetPct: number;
    price: number;
    sharesToBuy: number;
    cost: number;
    commission: number;
  };
  singleCommission: number;
  singleLeftover: number;
  commissionOptimizedBuys: {
    ticker: string;
    targetPct: number;
    sharesToBuy: number;
    cost: number;
    commission: number;
  }[];
  commissionOptimizedSpent: number;
  commissionOptimizedCommission: number;
  commissionOptimizedLeftover: number;
}

export function calculateRebalance(
  assetsWithValues: AssetWithValue[],
  totalValue: number,
  cash: number,
  commissionPercentage: number = 0,
  commissionMinimum: number = 0
): RebalanceResult | null {
  if (cash <= 0) return null;

  const sumTargets = assetsWithValues.reduce((s, a) => s + (a.target_percentage || 0), 0);
  const normalizationFactor = sumTargets > 0 ? (100 / sumTargets) : 1;

  const newTotal = totalValue + cash;

  let remainingCash = cash;
  const optimalBuys = assetsWithValues.map(asset => ({
    ticker: asset.ticker,
    targetPct: asset.target_percentage,
    normalizedTargetPct: asset.target_percentage * normalizationFactor,
    sharesToBuy: 0,
    cost: 0,
    commission: 0,
    price: asset.price ?? (asset.shares_owned > 0 ? (asset.currentValue || 0) / asset.shares_owned : 0)
  }));

  // PHASE 1: Optimal allocation - prioritize percentage accuracy
  let madePurchase = true;
  while (madePurchase && remainingCash > 0) {
    madePurchase = false;
    
    let mostUnder: { ticker: string; targetPct: number; sharesToBuy: number; cost: number; price: number } | null = null;
    let maxDeficit = -Infinity;

    for (const buy of optimalBuys) {
      if (buy.price <= 0 || buy.price > remainingCash) continue;

      const currentVal = (assetsWithValues.find(a => a.ticker === buy.ticker)?.currentValue || 0) + buy.cost;
      const targetVal = (totalValue + cash) * (buy.normalizedTargetPct / 100);
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

  // PHASE 2: Deploy leftover cash - maximize capital efficiency
  // After optimal allocation, spend remaining cash on shares that create smallest deviation
  while (remainingCash > 0) {
    let bestBuy: typeof optimalBuys[0] | null = null;
    let smallestDeviation = Infinity;
    
    for (const buy of optimalBuys) {
      if (buy.price <= 0 || buy.price > remainingCash) continue;
      
      // Calculate what the deviation would be AFTER buying one more share
      const currentVal = (assetsWithValues.find(a => a.ticker === buy.ticker)?.currentValue || 0) + buy.cost;
      const newVal = currentVal + buy.price;
      const totalSpent = cash - remainingCash + buy.price;
      const newTotal = totalValue + totalSpent;
      const newPct = newTotal > 0 ? (newVal / newTotal) * 100 : 0;
      const targetPct = buy.normalizedTargetPct;
      const deviation = Math.abs(newPct - targetPct);
      
      // Choose the purchase that creates the smallest deviation from target
      if (deviation < smallestDeviation) {
        smallestDeviation = deviation;
        bestBuy = buy;
      }
    }
    
    if (bestBuy) {
      bestBuy.sharesToBuy += 1;
      bestBuy.cost += bestBuy.price;
      remainingCash -= bestBuy.price;
    } else {
      break; // No affordable shares left
    }
  }

  const optimalBuysWithCommission = optimalBuys.map(buy => ({
    ...buy,
    commission: buy.cost > 0 ? calculateCommission(buy.cost, commissionPercentage, commissionMinimum, buy.ticker) : 0
  }));

  const optimalSpent = optimalBuysWithCommission.reduce((sum, b) => sum + b.cost, 0);
  const optimalCommission = optimalBuysWithCommission.reduce((sum, b) => sum + b.commission, 0);
  const optimalLeftover = remainingCash;

  const deviations = assetsWithValues.map((asset) => {
    const currentPct =
      totalValue > 0 ? ((asset.currentValue ?? 0) / totalValue) * 100 : 0;
    const normalizedTarget = asset.target_percentage * normalizationFactor;
    return { ...asset, deviation: normalizedTarget - currentPct };
  });
  deviations.sort((a, b) => b.deviation - a.deviation);

  let best = null;
  let bestPrice = 0;

  for (const asset of deviations) {
    let p = asset.price;
    if (p === null && asset.shares_owned > 0 && (asset.currentValue || 0) > 0) {
      p = (asset.currentValue || 0) / asset.shares_owned;
    }
    if (p && p > 0 && p <= cash) {
      best = asset;
      bestPrice = p;
      break;
    }
  }

  if (!best) {
    best = deviations[0];
    bestPrice = best.price ?? ((best.shares_owned > 0 && (best.currentValue || 0) > 0) ? (best.currentValue || 0) / best.shares_owned : 0);
  }

  const singleSharesToBuy = bestPrice && bestPrice > 0 ? Math.floor(cash / bestPrice) : 0;
  const singleCost = bestPrice && bestPrice > 0 ? singleSharesToBuy * bestPrice : 0;
  const singleCommission = singleCost > 0 ? calculateCommission(singleCost, commissionPercentage, commissionMinimum, best.ticker) : 0;

  // OPTION C: Commission-Optimized Strategy
  const commissionOptimizedResult = calculateCommissionOptimized(
    assetsWithValues,
    totalValue,
    cash,
    commissionPercentage,
    commissionMinimum
  );

  return {
    optimalBuys: optimalBuysWithCommission.map(({ price, ...rest }) => rest),
    optimalSpent,
    optimalCommission,
    optimalLeftover,
    singleBuy: {
      ticker: best.ticker,
      targetPct: best.target_percentage,
      price: bestPrice || 0,
      sharesToBuy: singleSharesToBuy,
      cost: singleCost,
      commission: singleCommission,
    },
    singleCommission,
    singleLeftover: cash - singleCost,
    ...commissionOptimizedResult,
  };
}

function calculateCommissionOptimized(
  assetsWithValues: AssetWithValue[],
  totalValue: number,
  cash: number,
  commissionPercentage: number,
  commissionMinimum: number
) {
  // Calculate normalized target percentages
  const sumTargets = assetsWithValues.reduce((s, a) => s + (a.target_percentage || 0), 0);
  const normalizationFactor = sumTargets > 0 ? (100 / sumTargets) : 1;

  // Build candidates list
  const candidates = assetsWithValues.map(asset => {
    const normalizedTargetPct = asset.target_percentage * normalizationFactor;
    const currentVal = asset.currentValue || 0;
    const targetVal = (totalValue + cash) * (normalizedTargetPct / 100);
    const deficit = targetVal - currentVal;
    
    return {
      ticker: asset.ticker,
      price: asset.price ?? (asset.shares_owned > 0 ? (asset.currentValue || 0) / asset.shares_owned : 0),
      deficit: deficit,
      targetPct: asset.target_percentage,
      normalizedTargetPct: normalizedTargetPct,
      currentValue: currentVal
    };
  }).filter(c => c.price > 0 && c.deficit > 0 && c.price <= cash);

  // Sort by deficit (most under-target first)
  candidates.sort((a, b) => b.deficit - a.deficit);

  if (candidates.length === 0) {
    return {
      commissionOptimizedBuys: [],
      commissionOptimizedSpent: 0,
      commissionOptimizedCommission: 0,
      commissionOptimizedLeftover: cash
    };
  }

  // Calculate breakeven point
  const breakeven = commissionPercentage > 0 
    ? commissionMinimum / (commissionPercentage / 100) 
    : Infinity;

  // Helper function to calculate total squared deviation for a stock selection
  const calculateTotalDeviation = (stocks: typeof candidates, cashToAllocate: number) => {
    const tempPurchases = stocks.map(s => ({ ...s, allocated: 0 }));
    let remaining = cashToAllocate;
    
    // Greedy allocation
    while (remaining > 0) {
      let bestStock = null;
      let minDev = Infinity;
      
      for (const stock of tempPurchases) {
        if (stock.price > remaining) continue;
        const newVal = stock.currentValue + stock.allocated + stock.price;
        const newTotal = totalValue + (cashToAllocate - remaining + stock.price);
        const newPct = newTotal > 0 ? (newVal / newTotal) * 100 : 0;
        const dev = Math.abs(newPct - stock.normalizedTargetPct);
        
        if (dev < minDev) {
          minDev = dev;
          bestStock = stock;
        }
      }
      
      if (bestStock) {
        bestStock.allocated += bestStock.price;
        remaining -= bestStock.price;
      } else {
        break;
      }
    }
    
    // Calculate total squared deviation
    return tempPurchases.reduce((sum, s) => {
      const finalVal = s.currentValue + s.allocated;
      const finalTotal = totalValue + (cashToAllocate - remaining);
      const finalPct = finalTotal > 0 ? (finalVal / finalTotal) * 100 : 0;
      const dev = Math.abs(finalPct - s.normalizedTargetPct);
      return sum + (dev * dev);
    }, 0);
  };

  // Determine optimal number of stocks to buy
  let selectedStocks: typeof candidates = [];
  
  if (breakeven === Infinity || breakeven === 0) {
    // No commission or no minimum - buy like Option B
    selectedStocks = candidates;
  } else {
    // COMMISSION-OPTIMIZED STRATEGY:
    // 1. Each stock must get ≥ breakeven (to avoid minimum commission)
    // 2. Choose combination with best percentage allocation + least leftover
    
    // Calculate how many stocks we can afford at breakeven each
    const maxStocksAboveBreakeven = Math.floor(cash / breakeven);
    
    if (maxStocksAboveBreakeven === 0) {
      // Can't afford any stock above breakeven - buy only 1 stock with all money
      selectedStocks = [candidates[0]];
    } else {
      // Test all combinations where each stock gets ≥ breakeven
      const testResults: Array<{
        count: number;
        deviation: number;
        leftover: number;
      }> = [];
      
      const maxToTest = Math.min(maxStocksAboveBreakeven, candidates.length);
      
      for (let count = 1; count <= maxToTest; count++) {
        const stocksToTest = candidates.slice(0, count);
        
        // Simulate allocation with breakeven constraint
        const simPurchases = stocksToTest.map(s => ({ ...s, allocated: 0 }));
        let simRemaining = cash;
        
        // Give each stock at least breakeven
        for (const p of simPurchases) {
          const shares = Math.floor(breakeven / p.price);
          p.allocated = shares * p.price;
          simRemaining -= p.allocated;
        }
        
        // Distribute remaining cash
        while (simRemaining > 0) {
          let best = null;
          let minDev = Infinity;
          
          for (const p of simPurchases) {
            if (p.price > simRemaining) continue;
            const newVal = p.currentValue + p.allocated + p.price;
            const newTotal = totalValue + (cash - simRemaining + p.price);
            const newPct = newTotal > 0 ? (newVal / newTotal) * 100 : 0;
            const dev = Math.abs(newPct - p.normalizedTargetPct);
            if (dev < minDev) {
              minDev = dev;
              best = p;
            }
          }
          
          if (best) {
            best.allocated += best.price;
            simRemaining -= best.price;
          } else {
            break;
          }
        }
        
        // Calculate total deviation
        const totalDev = simPurchases.reduce((sum, p) => {
          const finalVal = p.currentValue + p.allocated;
          const finalTotal = totalValue + (cash - simRemaining);
          const finalPct = finalTotal > 0 ? (finalVal / finalTotal) * 100 : 0;
          const dev = Math.abs(finalPct - p.normalizedTargetPct);
          return sum + (dev * dev);
        }, 0);
        
        testResults.push({ count, deviation: totalDev, leftover: simRemaining });
      }
      
      // Choose the option with best deviation (and least leftover as tiebreaker)
      let best = testResults[0];
      for (const result of testResults) {
        if (result.deviation < best.deviation || 
            (Math.abs(result.deviation - best.deviation) < 0.01 && result.leftover < best.leftover)) {
          best = result;
        }
      }
      
      selectedStocks = candidates.slice(0, best.count);
    }
  }

  // Allocate cash to selected stocks using the SAME logic as the selection phase
  const purchases = selectedStocks.map(stock => ({
    ticker: stock.ticker,
    targetPct: stock.targetPct,
    sharesToBuy: 0,
    cost: 0,
    commission: 0,
    price: stock.price,
    normalizedTargetPct: stock.normalizedTargetPct,
    currentValue: stock.currentValue
  }));

  let remainingCash = cash;

  // CRITICAL: Use the EXACT SAME allocation logic as the selection phase simulation
  // This ensures the actual allocation matches what we tested
  
  if (breakeven > 0 && breakeven < Infinity && selectedStocks.length > 0) {
    const maxStocksAboveBreakeven = Math.floor(cash / breakeven);
    
    if (maxStocksAboveBreakeven === 0) {
      // Can't afford breakeven - buy 1 stock with all money (greedy allocation)
      while (remainingCash > 0) {
        let bestBuy: typeof purchases[0] | null = null;
        let smallestDeviation = Infinity;
        
        for (const purchase of purchases) {
          if (purchase.price <= 0 || purchase.price > remainingCash) continue;
          
          const newCost = purchase.cost + purchase.price;
          const newValue = purchase.currentValue + newCost;
          const totalSpent = cash - remainingCash + purchase.price;
          const newTotal = totalValue + totalSpent;
          const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
          const deviation = Math.abs(newPct - purchase.normalizedTargetPct);
          
          if (deviation < smallestDeviation) {
            smallestDeviation = deviation;
            bestBuy = purchase;
          }
        }
        
        if (bestBuy) {
          bestBuy.sharesToBuy += 1;
          bestBuy.cost += bestBuy.price;
          remainingCash -= bestBuy.price;
        } else {
          break;
        }
      }
    } else {
      // PHASE 1: Give each selected stock at least breakeven
      for (const purchase of purchases) {
        const sharesToBuy = Math.floor(breakeven / purchase.price);
        const cost = sharesToBuy * purchase.price;
        
        if (cost >= breakeven && remainingCash >= cost) {
          purchase.sharesToBuy = sharesToBuy;
          purchase.cost = cost;
          remainingCash -= cost;
        }
      }
      
      // PHASE 2: Distribute remaining cash using greedy allocation
      while (remainingCash > 0) {
        let bestBuy: typeof purchases[0] | null = null;
        let smallestDeviation = Infinity;
        
        for (const purchase of purchases) {
          if (purchase.price <= 0 || purchase.price > remainingCash) continue;
          if (purchase.cost === 0) continue; // Skip stocks that didn't get initial allocation
          
          const newCost = purchase.cost + purchase.price;
          const newValue = purchase.currentValue + newCost;
          const totalSpent = cash - remainingCash + purchase.price;
          const newTotal = totalValue + totalSpent;
          const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
          const deviation = Math.abs(newPct - purchase.normalizedTargetPct);
          
          if (deviation < smallestDeviation) {
            smallestDeviation = deviation;
            bestBuy = purchase;
          }
        }
        
        if (bestBuy) {
          bestBuy.sharesToBuy += 1;
          bestBuy.cost += bestBuy.price;
          remainingCash -= bestBuy.price;
        } else {
          break;
        }
      }
    }
  } else {
    // No breakeven constraint, use simple greedy allocation
    while (remainingCash > 0) {
      let bestBuy: typeof purchases[0] | null = null;
      let smallestDeviation = Infinity;
      
      for (const purchase of purchases) {
        if (purchase.price <= 0 || purchase.price > remainingCash) continue;
        
        const newCost = purchase.cost + purchase.price;
        const newValue = purchase.currentValue + newCost;
        const totalSpent = cash - remainingCash + purchase.price;
        const newTotal = totalValue + totalSpent;
        const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
        const deviation = Math.abs(newPct - purchase.normalizedTargetPct);
        
        if (deviation < smallestDeviation) {
          smallestDeviation = deviation;
          bestBuy = purchase;
        }
      }
      
      if (bestBuy) {
        bestBuy.sharesToBuy += 1;
        bestBuy.cost += bestBuy.price;
        remainingCash -= bestBuy.price;
      } else {
        break;
      }
    }
  }

  // Calculate commissions
  purchases.forEach(purchase => {
    if (purchase.cost > 0) {
      purchase.commission = calculateCommission(
        purchase.cost,
        commissionPercentage,
        commissionMinimum,
        purchase.ticker
      );
    }
  });

  const activePurchases = purchases.filter(p => p.sharesToBuy > 0);

  return {
    commissionOptimizedBuys: activePurchases.map(({ price, normalizedTargetPct, currentValue, ...rest }) => rest),
    commissionOptimizedSpent: cash - remainingCash,
    commissionOptimizedCommission: activePurchases.reduce((sum, p) => sum + p.commission, 0),
    commissionOptimizedLeftover: remainingCash
  };
}

export function RebalanceCalculator({
  assets,
  assetsWithValues,
  prices,
  names,
  cashAmount,
  setCashAmount,
  priceOverrides,
  setPriceOverrides,
  excludedAssets = new Set(),
  onExcludedAssetsChange,
  commissionPercentage = 0,
  commissionMinimum = 0,
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
  commissionPercentage?: number;
  commissionMinimum?: number;
}) {
  const [showOptionA, setShowOptionA] = React.useState(false);
  const [showOptionB, setShowOptionB] = React.useState(false);
  const [showOptionC, setShowOptionC] = React.useState(false);
  const [manualValuationsOpen, setManualValuationsOpen] = React.useState(false);
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

  const includedAssetsWithValues = effectiveAssetsWithValues.filter(a => !excludedAssets.has(a.ticker));

  const sumTargets = includedAssetsWithValues.reduce((sum, a) => sum + (a.target_percentage || 0), 0);
  const effectiveTotalValue = includedAssetsWithValues.reduce((sum, a) => sum + (a.currentValue ?? 0), 0);

  const result = calculateRebalance(
    includedAssetsWithValues,
    effectiveTotalValue,
    parseFloat(cashAmount) || 0,
    commissionPercentage,
    commissionMinimum
  );

  return (
    <div className="grid gap-6 mobile:gap-12 lg:grid-cols-[1fr_450px] h-full">
      <div className="flex flex-col min-h-0 space-y-6 mobile:space-y-8">
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
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex flex-col gap-1">
              <Label className="text-sm uppercase tracking-[0.3em] font-black font-heading">02. Manual Valuations</Label>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
                Override position values for technical precision.
              </span>
            </div>
            <button
              onClick={() => setManualValuationsOpen(!manualValuationsOpen)}
              className="rounded-none h-8 mobile:h-10 px-2 mobile:px-4 text-[8px] mobile:text-[10px] font-black uppercase tracking-widest bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 border border-white/40 dark:border-white/30 transition-all cursor-pointer whitespace-nowrap"
            >
              {manualValuationsOpen ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          
          {manualValuationsOpen && (
          <div className="flex-1 border border-white/10 bg-white/[0.02]">
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
                    {(asset as AssetWithValue).priceSource === 'manual' && (
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
          )}
        </div>
      </div>

      <div className="flex flex-col min-h-0 space-y-6">
        <div className="flex flex-col gap-1 px-1">
          <Label className="text-sm uppercase tracking-[0.3em] font-black font-heading">03. Execution Plan</Label>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
              Automated allocation strategies.
            </span>
            {sumTargets !== 100 && sumTargets > 0 && (
              <div className="px-2 py-1 bg-orange-400/10 border border-orange-400/30 text-[8px] text-orange-400 font-black uppercase tracking-widest flex items-center gap-2">
                <span className="h-1 w-1 bg-orange-400 rounded-full animate-pulse" />
                Target sum is {sumTargets}% - relative weights normalized
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-8 pr-2">
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
              
              <div className="bg-white/40 dark:bg-white/5 border-2 border-gray-300 dark:border-white/20 p-4 mobile:p-8 space-y-4 mobile:space-y-6 relative overflow-hidden group">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 mobile:gap-4">
                    <div className="h-6 mobile:h-8 w-1 bg-white dark:bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                    <h3 className="text-xs mobile:text-sm font-black uppercase tracking-[0.2em] mobile:tracking-[0.3em] font-heading">Single Asset Entry</h3>
                  </div>
                  <button
                    onClick={() => setShowOptionA(!showOptionA)}
                    className="rounded-none h-8 mobile:h-10 px-2 mobile:px-4 text-[8px] mobile:text-[10px] font-black uppercase tracking-widest bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 border border-gray-300 dark:border-white/30 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {showOptionA ? 'HIDE' : 'VIEW'} ALLOCATION
                  </button>
                </div>
                
                <div className="bg-background border border-gray-300 dark:border-white/30 p-4 mobile:p-6 flex items-center justify-between shadow-xl">
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
                    {result.singleBuy.commission > 0 && (
                      <div className="text-[8px] mobile:text-[9px] text-orange-400 font-black font-mono">
                        + ₪{result.singleBuy.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })} commission
                      </div>
                    )}
                  </div>
                </div>

                {showOptionA && (
                  <div className="bg-white/20 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-4 mobile:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Post-Investment Allocation:</div>
                    <div className="space-y-2 divide-y divide-gray-200 dark:divide-white/5">
                      {effectiveAssetsWithValues.filter(a => !excludedAssets.has(a.ticker)).map((asset) => {
                        const newValue = (asset.currentValue || 0) + (asset.ticker === result.singleBuy.ticker ? result.singleBuy.cost : 0);
                        const newTotal = effectiveTotalValue + result.singleBuy.cost;
                        const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
                        const isInvested = asset.ticker === result.singleBuy.ticker;
                        return (
                          <div 
                            key={asset.ticker} 
                            className={`flex items-center justify-between text-[10px] p-3 rounded-none transition-all ${
                              isInvested 
                                ? 'bg-white/40 dark:bg-white/20 border-l-2 border-gray-400 dark:border-white/40 font-black' 
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

                <div className="flex justify-between items-center border-t-2 border-gray-300 dark:border-white/10 pt-4 space-y-2">
                  <div className="space-y-2 w-full">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Buy Amount:</span>
                      <span className="text-sm font-black font-mono text-black dark:text-white">
                        ₪{result.singleBuy.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {result.singleCommission > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-orange-400 uppercase font-black tracking-widest">Commission:</span>
                        <span className="text-sm font-black font-mono text-orange-400">
                          ₪{result.singleCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t-2 border-gray-300 dark:border-white/10 pt-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Leftover Cash:</span>
                      <span className="text-sm font-black font-mono text-black dark:text-white">
                        ₪{result.singleLeftover.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              
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
                        onClick={() => setShowOptionB(!showOptionB)}
                        className="rounded-none h-8 mobile:h-10 px-2 mobile:px-4 text-[8px] mobile:text-[10px] font-black uppercase tracking-widest bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {showOptionB ? 'HIDE' : 'VIEW'} ALLOCATION
                      </button>
                    </div>
                    <div className="space-y-px bg-white/5 border border-white/10 shadow-xl overflow-hidden">
                      {activeOptimal.map((buy) => (
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
                            {buy.commission > 0 && (
                              <div className="text-[7px] mobile:text-[8px] text-orange-400 font-black font-mono">
                                + ₪{buy.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 space-y-3 border-t border-primary/10">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Total Invested:</span>
                        <span className="text-sm font-black font-mono text-primary">₪{result.optimalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      {result.optimalCommission > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-orange-400 uppercase font-black tracking-widest">Total Commission:</span>
                          <span className="text-sm font-black font-mono text-orange-400">₪{result.optimalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-primary/10 pt-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Leftover Cash:</span>
                        <span className="text-sm font-black font-mono text-primary">₪{result.optimalLeftover.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {showOptionB && (
                      <div className="bg-white/[0.02] border border-primary/10 p-4 mobile:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Post-Investment Allocation:</div>
                        <div className="space-y-2">
                          {effectiveAssetsWithValues.filter(a => !excludedAssets.has(a.ticker)).map((asset) => {
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

              {/* OPTION C: Commission-Optimized Strategy */}
              {(() => {
                const activeCommissionOptimized = result.commissionOptimizedBuys.filter(b => b.cost > 0);
                
                // Hide if no purchases
                if (activeCommissionOptimized.length === 0) {
                  return null;
                }
                
                // Check if identical to Option A
                const isSameAsA = activeCommissionOptimized.length === 1 && 
                  activeCommissionOptimized[0].ticker === result.singleBuy.ticker && 
                  activeCommissionOptimized[0].sharesToBuy === result.singleBuy.sharesToBuy;
                
                // Check if identical to Option B
                const activeOptimal = result.optimalBuys.filter(b => b.cost > 0);
                const isSameAsB = activeCommissionOptimized.length === activeOptimal.length &&
                  activeCommissionOptimized.every(c => {
                    const optimalBuy = activeOptimal.find(o => o.ticker === c.ticker);
                    return optimalBuy && optimalBuy.sharesToBuy === c.sharesToBuy;
                  });
                
                // Hide if identical to other options
                if (isSameAsA || isSameAsB) {
                  return null;
                }

                return (
                  <div className="bg-green-500/5 border border-green-500/20 p-4 mobile:p-8 space-y-4 mobile:space-y-6 relative overflow-hidden group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 mobile:gap-4">
                        <div className="h-6 mobile:h-8 w-1 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
                        <h3 className="text-xs mobile:text-sm font-black uppercase tracking-[0.2em] mobile:tracking-[0.3em] font-heading">Commission-Optimized</h3>
                      </div>
                      <button
                        onClick={() => setShowOptionC(!showOptionC)}
                        className="rounded-none h-8 mobile:h-10 px-2 mobile:px-4 text-[8px] mobile:text-[10px] font-black uppercase tracking-widest bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {showOptionC ? 'HIDE' : 'VIEW'} ALLOCATION
                      </button>
                    </div>
                    
                    <div className="space-y-px bg-white/5 border border-white/10 shadow-xl overflow-hidden">
                      {activeCommissionOptimized.map((buy) => (
                        <div key={buy.ticker} className="flex items-center justify-between bg-background p-4 mobile:p-6 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <div>
                            <div className="font-black text-xs mobile:text-sm uppercase text-glow">{buy.ticker}</div>
                            <div className="text-[8px] mobile:text-[9px] text-muted-foreground font-black tracking-widest uppercase opacity-60">TARGET: {buy.targetPct.toFixed(1)}%</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-green-500 text-xs mobile:text-sm uppercase">
                              {buy.sharesToBuy > 0 
                                ? `+${buy.sharesToBuy} UNITS` 
                                : `+₪${buy.cost.toLocaleString()}`}
                            </div>
                            <div className="text-[8px] mobile:text-[9px] text-muted-foreground font-black font-mono">
                              ₪{buy.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            {buy.commission > 0 && (
                              <div className="text-[7px] mobile:text-[8px] text-orange-400 font-black font-mono">
                                + ₪{buy.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-4 space-y-3 border-t border-green-500/10">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Total Invested:</span>
                        <span className="text-sm font-black font-mono text-green-500">₪{result.commissionOptimizedSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      {result.commissionOptimizedCommission > 0 && (
                        <div className="flex justify-between items-center bg-green-500/10 p-2 rounded-none">
                          <span className="text-[10px] text-green-500 uppercase font-black tracking-widest">Total Commission (OPTIMIZED):</span>
                          <span className="text-sm font-black font-mono text-green-500">₪{result.commissionOptimizedCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-green-500/10 pt-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Leftover Cash:</span>
                        <span className="text-sm font-black font-mono text-green-500">₪{result.commissionOptimizedLeftover.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      {/* Commission savings comparison */}
                      {result.optimalCommission > result.commissionOptimizedCommission && result.commissionOptimizedCommission > 0 && (
                        <div className="text-[9px] text-green-500 font-black uppercase tracking-widest bg-green-500/10 p-2 border border-green-500/30 flex items-center gap-2">
                          <span>💰</span>
                          <span>Saves ₪{(result.optimalCommission - result.commissionOptimizedCommission).toLocaleString(undefined, { minimumFractionDigits: 2 })} vs Optimal Balance</span>
                        </div>
                      )}
                    </div>

                    {showOptionC && (
                      <div className="bg-white/[0.02] border border-green-500/10 p-4 mobile:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Post-Investment Allocation:</div>
                        <div className="space-y-2">
                          {effectiveAssetsWithValues.filter(a => !excludedAssets.has(a.ticker)).map((asset) => {
                            const buyForThisAsset = result.commissionOptimizedBuys.find(b => b.ticker === asset.ticker);
                            const newValue = (asset.currentValue || 0) + (buyForThisAsset?.cost || 0);
                            const newTotal = effectiveTotalValue + result.commissionOptimizedSpent;
                            const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0;
                            const isInvested = (buyForThisAsset?.cost || 0) > 0;
                            return (
                              <div 
                                key={asset.ticker} 
                                className={`flex items-center justify-between text-[10px] p-3 rounded-none transition-all ${
                                  isInvested 
                                    ? 'bg-green-500/20 border border-green-500/40 font-black' 
                                    : 'bg-transparent'
                                }`}
                              >
                                <span className="font-black uppercase">{asset.ticker}</span>
                                <span className={`font-mono ${isInvested ? 'text-green-500' : 'text-muted-foreground'}`}>{newPct.toFixed(2)}%</span>
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
