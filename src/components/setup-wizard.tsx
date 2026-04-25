"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortfolio, addAsset } from "@/actions/portfolio";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AssetRow {
  ticker: string;
  targetPercentage: string;
  sharesOwned: string;
}

export function SetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [portfolioName, setPortfolioName] = useState("My Portfolio");
  const [assets, setAssets] = useState<AssetRow[]>([
    { ticker: "", targetPercentage: "", sharesOwned: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const updateURL = (params: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    });
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${window.location.pathname}${query}`, { scroll: false });
  };

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10);
      if (stepNum >= 1 && stepNum <= 2) {
        setStep(stepNum);
      }
    }
  }, [searchParams]);

  function addRow() {
    setAssets([
      ...assets,
      { ticker: "", targetPercentage: "", sharesOwned: "" },
    ]);
  }

  function removeRow(index: number) {
    if (assets.length <= 1) return;
    setAssets(assets.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof AssetRow, value: string) {
    const updated = [...assets];
    updated[index] = { ...updated[index], [field]: value };
    setAssets(updated);
  }

  const totalPercentage = assets.reduce(
    (sum, a) => sum + (parseFloat(a.targetPercentage) || 0),
    0
  );

  function handleFinishClick() {
    // Validation
    for (const asset of assets) {
      if (!asset.ticker.trim()) {
        toast.error("All assets must have a ticker / security number");
        return;
      }
      if (!asset.targetPercentage || parseFloat(asset.targetPercentage) <= 0) {
        toast.error("All assets must have a target percentage greater than 0");
        return;
      }
    }

    // Show confirmation if not 100%
    if (totalPercentage !== 100) {
      setShowConfirmDialog(true);
      return;
    }

    // Otherwise proceed directly
    handleFinish();
  }

  async function handleFinish() {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      const portfolio = await createPortfolio(portfolioName);

      for (const asset of assets) {
        await addAsset(
          portfolio.id,
          asset.ticker.trim(),
          parseFloat(asset.targetPercentage),
          parseFloat(asset.sharesOwned) || 0
        );
      }

      toast.success("Portfolio created successfully!");
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create portfolio";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-primary"
                  : s < step
                  ? "w-8 bg-primary/40"
                  : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">
                Welcome! Let&apos;s set up your portfolio
              </CardTitle>
              <CardDescription>
                Give your portfolio a name. You can change this later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portfolio-name">Portfolio Name</Label>
                <Input
                  id="portfolio-name"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="e.g., Retirement Fund"
                />
              </div>
              <Button onClick={() => {
                setStep(2);
                updateURL({ step: '2' });
              }} className="w-full h-10">
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">
                Add your assets
              </CardTitle>
              <CardDescription>
                Enter the TASE security number (e.g. 1159250) or Yahoo ticker,
                the target allocation %, and how many shares you currently own.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_100px_100px_40px] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Ticker / Security #</span>
                <span>Target %</span>
                <span>Shares</span>
                <span />
              </div>

              {assets.map((asset, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_100px_100px_40px] gap-3 items-end"
                >
                  <Input
                    placeholder="e.g. 1159250"
                    value={asset.ticker}
                    onChange={(e) => updateRow(idx, "ticker", e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="%"
                    min="0"
                    max="100"
                    step="0.1"
                    value={asset.targetPercentage}
                    onChange={(e) =>
                      updateRow(idx, "targetPercentage", e.target.value)
                    }
                  />
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="1"
                    value={asset.sharesOwned}
                    onChange={(e) =>
                      updateRow(idx, "sharesOwned", e.target.value)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(idx)}
                    disabled={assets.length <= 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </Button>
                </div>
              ))}

              {/* Total indicator */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Total allocation
                </span>
                <span
                  className={`font-semibold ${
                    totalPercentage === 100
                      ? "text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {totalPercentage}%
                </span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={addRow} className="flex-1">
                  + Add Asset
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(1);
                    updateURL({ step: '1' });
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleFinishClick}
                  disabled={loading}
                  className="flex-1 h-10"
                >
                  {loading ? "Creating…" : "Create Portfolio"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocation doesn&apos;t equal 100%</DialogTitle>
            <DialogDescription>
              Your target allocations add up to {totalPercentage}%, not 100%. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFinish}>
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
