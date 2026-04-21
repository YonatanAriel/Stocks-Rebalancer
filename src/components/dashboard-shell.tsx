"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signout } from "@/actions/auth";
import { getAssetPrice } from "@/actions/finance";
import { updateAsset, deleteAsset, addAsset } from "@/actions/portfolio";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AllocationChart } from "@/components/allocation-chart";

// ─── Types ──────────────────────────────────────────────────
interface Asset {
  id: string;
  portfolio_id: string;
  ticker: string;
  target_percentage: number;
  shares_owned: number;
}

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  assets: Asset[];
}

interface PriceMap {
  [ticker: string]: number | null;
}

// ─── Component ──────────────────────────────────────────────
export function DashboardShell({
  portfolio,
  userEmail,
}: {
  portfolio: Portfolio;
  userEmail: string;
}) {
  const router = useRouter();
  const [prices, setPrices] = useState<PriceMap>({});
  const [priceOverrides, setPriceOverrides] = useState<{ [ticker: string]: string }>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [cashAmount, setCashAmount] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [addingAsset, setAddingAsset] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newShares, setNewShares] = useState("0");

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

  // ─── Price helpers ────────────────────────────────────────
  function getEffectivePrice(ticker: string): number | null {
    const override = priceOverrides[ticker];
    if (override && parseFloat(override) > 0) {
      return parseFloat(override);
    }
    return prices[ticker] ?? null;
  }

  // ─── Portfolio calculations ───────────────────────────────
  const assetsWithValues = portfolio.assets.map((asset) => {
    const price = getEffectivePrice(asset.ticker);
    const currentValue = price ? asset.shares_owned * price : null;
    return { ...asset, price, currentValue };
  });

  const totalValue = assetsWithValues.reduce(
    (sum, a) => sum + (a.currentValue ?? 0),
    0
  );

  const allPricesAvailable = assetsWithValues.every(
    (a) => a.price !== null
  );

  // ─── Rebalance algorithm ──────────────────────────────────
  function calculateRebalance(cash: number) {
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
        currentValue: asset.currentValue ?? 0,
        price: asset.price!,
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
      return {
        ...asset,
        deviation: asset.target_percentage - currentPct,
      };
    });

    // Sort by most under-allocated
    deviations.sort((a, b) => b.deviation - a.deviation);
    const bestSingle = deviations[0];
    const singleSharesToBuy = Math.floor(cash / bestSingle.price!);
    const singleCost = singleSharesToBuy * bestSingle.price!;
    const singleLeftover = cash - singleCost;

    return {
      optimalBuys,
      optimalSpent,
      optimalLeftover,
      singleBuy: {
        ticker: bestSingle.ticker,
        targetPct: bestSingle.target_percentage,
        price: bestSingle.price!,
        sharesToBuy: singleSharesToBuy,
        cost: singleCost,
      },
      singleLeftover,
    };
  }

  const rebalanceResult = showCalculator
    ? calculateRebalance(parseFloat(cashAmount) || 0)
    : null;

  // ─── Edit asset handler ───────────────────────────────────
  async function handleEditSave() {
    if (!editingAsset) return;
    try {
      await updateAsset(editingAsset.id, {
        shares_owned: parseFloat(editShares) || 0,
        target_percentage: parseFloat(editPercentage) || 0,
      });
      toast.success("Asset updated");
      setEditingAsset(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleDeleteAsset(id: string) {
    try {
      await deleteAsset(id);
      toast.success("Asset removed");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleAddAsset() {
    if (!newTicker.trim() || !newPercentage) return;
    try {
      await addAsset(
        portfolio.id,
        newTicker.trim(),
        parseFloat(newPercentage),
        parseFloat(newShares) || 0
      );
      toast.success("Asset added");
      setAddingAsset(false);
      setNewTicker("");
      setNewPercentage("");
      setNewShares("0");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-primary"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="text-sm font-semibold">Rebalancer</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {userEmail}
            </span>
            <form action={signout}>
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        {/* Portfolio header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {portfolio.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {portfolio.assets.length} asset
              {portfolio.assets.length !== 1 ? "s" : ""} ·{" "}
              {loadingPrices
                ? "Loading prices…"
                : `₪${totalValue.toLocaleString("en-IL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} total value`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddingAsset(true)}>
              + Add Asset
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCalculator(!showCalculator)}
              className="glow-primary"
            >
              {showCalculator ? "Hide Calculator" : "💰 Invest New Cash"}
            </Button>
          </div>
        </div>

        {/* Allocation chart & assets grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Assets list */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_80px_90px_60px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                <span>Ticker</span>
                <span className="text-right">Target</span>
                <span className="text-right">Shares</span>
                <span className="text-right">Value</span>
                <span />
              </div>

              {assetsWithValues.map((asset) => {
                const currentPct =
                  totalValue > 0 && asset.currentValue
                    ? (asset.currentValue / totalValue) * 100
                    : 0;

                return (
                  <div
                    key={asset.id}
                    className="grid grid-cols-[1fr_80px_80px_90px_60px] gap-2 items-center rounded-lg bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-sm">
                        {asset.ticker}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {asset.price !== null
                          ? `₪${asset.price.toLocaleString("en-IL", {
                              minimumFractionDigits: 2,
                            })}`
                          : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {asset.target_percentage}%
                      </span>
                      <div
                        className={`text-xs ${
                          Math.abs(currentPct - asset.target_percentage) < 1
                            ? "text-emerald-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {currentPct.toFixed(1)}%
                      </div>
                    </div>
                    <span className="text-sm text-right">
                      {asset.shares_owned}
                    </span>
                    <span className="text-sm font-medium text-right">
                      {asset.currentValue !== null
                        ? `₪${asset.currentValue.toLocaleString("en-IL", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}`
                        : "—"}
                    </span>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setEditingAsset(asset);
                          setEditShares(String(asset.shares_owned));
                          setEditPercentage(String(asset.target_percentage));
                        }}
                        className="text-muted-foreground"
                      >
                        ✎
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Allocation chart */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPrices ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : (
                <AllocationChart
                  assets={assetsWithValues.map((a) => ({
                    ticker: a.ticker,
                    targetPct: a.target_percentage,
                    currentPct:
                      totalValue > 0 && a.currentValue
                        ? (a.currentValue / totalValue) * 100
                        : 0,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Calculator Panel ──────────────────────────── */}
        {showCalculator && (
          <Card className="glass border-primary/30 glow-primary">
            <CardHeader>
              <CardTitle className="text-lg">
                💰 Rebalance Calculator
              </CardTitle>
              <CardDescription>
                Enter how much cash you want to invest and optionally override
                prices with live values from your brokerage.
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
                  Price overrides (optional — enter live prices from your
                  brokerage)
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {portfolio.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 rounded-lg bg-muted/30 p-2"
                    >
                      <span className="text-sm font-medium w-24 truncate">
                        {asset.ticker}
                      </span>
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
                          setPriceOverrides({
                            ...priceOverrides,
                            [asset.ticker]: e.target.value,
                          })
                        }
                        className="flex-1 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              {rebalanceResult && (
                <div className="space-y-4">
                  {/* Option A: Single ETF */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 items-center rounded-md bg-emerald-500/20 px-2 text-xs font-semibold text-emerald-400">
                        Recommended
                      </span>
                      <h3 className="text-sm font-semibold">
                        Option A: Buy Single Asset
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minimizes commission — buy only the most under-allocated
                      asset.
                    </p>
                    <div className="rounded-lg bg-background/50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">
                            {rebalanceResult.singleBuy.ticker}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            (target: {rebalanceResult.singleBuy.targetPct}%)
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-400">
                            Buy {rebalanceResult.singleBuy.sharesToBuy} shares
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ₪
                            {rebalanceResult.singleBuy.cost.toLocaleString(
                              "en-IL",
                              { minimumFractionDigits: 2 }
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Leftover cash:{" "}
                      <span className="font-medium text-foreground">
                        ₪
                        {rebalanceResult.singleLeftover.toLocaleString(
                          "en-IL",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Option B: Multi ETF */}
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <h3 className="text-sm font-semibold">
                      Option B: Optimal Rebalance
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Spread across multiple assets for the best balance. You
                      may pay commission on each.
                    </p>
                    <div className="space-y-2">
                      {rebalanceResult.optimalBuys
                        .filter((b) => b.sharesToBuy > 0)
                        .map((buy) => (
                          <div
                            key={buy.ticker}
                            className="flex items-center justify-between rounded-lg bg-background/50 p-3"
                          >
                            <div>
                              <span className="font-semibold">
                                {buy.ticker}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                (target: {buy.targetPct}%)
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-primary">
                                Buy {buy.sharesToBuy} shares
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ₪
                                {buy.cost.toLocaleString("en-IL", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total spent:{" "}
                      <span className="font-medium text-foreground">
                        ₪
                        {rebalanceResult.optimalSpent.toLocaleString(
                          "en-IL",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>{" "}
                      · Leftover:{" "}
                      <span className="font-medium text-foreground">
                        ₪
                        {rebalanceResult.optimalLeftover.toLocaleString(
                          "en-IL",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* ─── Edit Asset Dialog ──────────────────────────── */}
      <Dialog
        open={!!editingAsset}
        onOpenChange={(open) => !open && setEditingAsset(null)}
      >
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Edit {editingAsset?.ticker}</DialogTitle>
            <DialogDescription>
              Update target percentage and shares owned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Target Percentage (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={editPercentage}
                onChange={(e) => setEditPercentage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Shares Owned</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={editShares}
                onChange={(e) => setEditShares(e.target.value)}
              />
            </div>
            <Button onClick={handleEditSave} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Asset Dialog ───────────────────────────── */}
      <Dialog
        open={addingAsset}
        onOpenChange={(open) => !open && setAddingAsset(false)}
      >
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>
              Enter the ticker, target %, and current shares.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Ticker / Security Number</Label>
              <Input
                placeholder="e.g. 1159250"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Percentage (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newPercentage}
                onChange={(e) => setNewPercentage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Shares Owned</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={newShares}
                onChange={(e) => setNewShares(e.target.value)}
              />
            </div>
            <Button onClick={handleAddAsset} className="w-full">
              Add Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
