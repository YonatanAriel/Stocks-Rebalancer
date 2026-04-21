"use client";

import { useState, useEffect, useCallback } from "react";
import { getAssetPrice } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/header";
import { AssetsList } from "@/components/dashboard/assets-list";
import { RebalanceCalculator } from "@/components/dashboard/rebalance-calculator";
import { AllocationChart } from "@/components/allocation-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Portfolio, PriceMap, AssetWithValue } from "@/lib/types";

export function DashboardShell({
  portfolio,
  userEmail,
}: {
  portfolio: Portfolio;
  userEmail: string;
}) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [cashAmount, setCashAmount] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);

  // Fetch all prices on mount
  const fetchPrices = useCallback(async () => {
    setLoadingPrices(true);
    const newPrices: PriceMap = {};
    await Promise.all(
      portfolio.assets.map(async (asset) => {
        const result = await getAssetPrice(asset.ticker);
        newPrices[asset.ticker] = result.price;
      })
    );
    setPrices(newPrices);
    setLoadingPrices(false);
  }, [portfolio.assets]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Compute effective prices (with overrides)
  function getEffectivePrice(ticker: string): number | null {
    const override = priceOverrides[ticker];
    if (override && parseFloat(override) > 0) return parseFloat(override);
    return prices[ticker] ?? null;
  }

  const assetsWithValues: AssetWithValue[] = portfolio.assets.map((asset) => {
    const price = getEffectivePrice(asset.ticker);
    return { ...asset, price, currentValue: price ? asset.shares_owned * price : null };
  });

  const totalValue = assetsWithValues.reduce((sum, a) => sum + (a.currentValue ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader userEmail={userEmail} />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        {/* Portfolio title row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{portfolio.name}</h1>
            <p className="text-sm text-muted-foreground">
              {portfolio.assets.length} asset{portfolio.assets.length !== 1 ? "s" : ""} ·{" "}
              {loadingPrices
                ? "Loading prices…"
                : `₪${totalValue.toLocaleString("en-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total value`}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCalculator(!showCalculator)} className="glow-primary">
            {showCalculator ? "Hide Calculator" : "💰 Invest New Cash"}
          </Button>
        </div>

        {/* Assets + chart grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <AssetsList assets={assetsWithValues} totalValue={totalValue} portfolioId={portfolio.id} />

          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPrices ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <AllocationChart
                  assets={assetsWithValues.map((a) => ({
                    ticker: a.ticker,
                    targetPct: a.target_percentage,
                    currentPct: totalValue > 0 && a.currentValue ? (a.currentValue / totalValue) * 100 : 0,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calculator panel */}
        {showCalculator && (
          <RebalanceCalculator
            assets={portfolio.assets}
            assetsWithValues={assetsWithValues}
            totalValue={totalValue}
            prices={prices}
            cashAmount={cashAmount}
            setCashAmount={setCashAmount}
            priceOverrides={priceOverrides}
            setPriceOverrides={setPriceOverrides}
          />
        )}
      </main>
    </div>
  );
}
