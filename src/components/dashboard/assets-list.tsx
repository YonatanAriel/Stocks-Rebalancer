"use client";

import { useRouter } from "next/navigation";
import { updateAsset, deleteAsset, addAsset } from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import type { AssetWithValue, Asset } from "@/lib/types";

// ─── Asset Row ──────────────────────────────────────────────
function AssetRow({
  asset,
  totalValue,
  onEdit,
  onDelete,
}: {
  asset: AssetWithValue;
  totalValue: number;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}) {
  const currentPct =
    totalValue > 0 && asset.currentValue
      ? (asset.currentValue / totalValue) * 100
      : 0;

  return (
    <div className="grid grid-cols-[1fr_80px_80px_90px_60px] gap-2 items-center rounded-lg bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors">
      <div>
        <span className="font-medium text-sm">{asset.ticker}</span>
        <div className="text-xs text-muted-foreground">
          {asset.price !== null
            ? `₪${asset.price.toLocaleString("en-IL", { minimumFractionDigits: 2 })}`
            : "—"}
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-medium">{asset.target_percentage}%</span>
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
      <span className="text-sm text-right">{asset.shares_owned}</span>
      <span className="text-sm font-medium text-right">
        {asset.currentValue !== null
          ? `₪${asset.currentValue.toLocaleString("en-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
          : "—"}
      </span>
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" size="icon-xs" onClick={() => onEdit(asset)} className="text-muted-foreground">
          ✎
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => onDelete(asset.id)} className="text-muted-foreground hover:text-destructive">
          ×
        </Button>
      </div>
    </div>
  );
}

// ─── Assets List Card ───────────────────────────────────────
export function AssetsList({
  assets,
  totalValue,
  portfolioId,
}: {
  assets: AssetWithValue[];
  totalValue: number;
  portfolioId: string;
}) {
  const router = useRouter();
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [addingAsset, setAddingAsset] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newShares, setNewShares] = useState("");

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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function handleDeleteAsset(id: string) {
    try {
      await deleteAsset(id);
      toast.success("Asset removed");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function handleAddAsset() {
    if (!newTicker.trim() || !newPercentage) return;
    try {
      await addAsset(portfolioId, newTicker.trim(), parseFloat(newPercentage), parseFloat(newShares) || 0);
      toast.success("Asset added");
      setAddingAsset(false);
      setNewTicker("");
      setNewPercentage("");
      setNewShares("");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Add failed");
    }
  }

  return (
    <>
      <Card className="glass border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Your Assets</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddingAsset(true)}>
            + Add Asset
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_80px_80px_90px_60px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            <span>Ticker</span>
            <span className="text-right">Target</span>
            <span className="text-right">Shares</span>
            <span className="text-right">Value</span>
            <span />
          </div>
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              totalValue={totalValue}
              onEdit={(a) => {
                setEditingAsset(a);
                setEditShares(String(a.shares_owned));
                setEditPercentage(String(a.target_percentage));
              }}
              onDelete={handleDeleteAsset}
            />
          ))}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Edit {editingAsset?.ticker}</DialogTitle>
            <DialogDescription>Update target percentage and shares owned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Target Percentage (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={editPercentage} onChange={(e) => setEditPercentage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Shares Owned</Label>
              <Input type="number" min="0" step="1" value={editShares} onChange={(e) => setEditShares(e.target.value)} />
            </div>
            <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addingAsset} onOpenChange={(open) => !open && setAddingAsset(false)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>Enter the ticker, target %, and current shares.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Ticker / Security Number</Label>
              <Input placeholder="e.g. 1159250" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Target Percentage (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={newPercentage} onChange={(e) => setNewPercentage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Shares Owned</Label>
              <Input type="number" min="0" step="1" value={newShares} onChange={(e) => setNewShares(e.target.value)} />
            </div>
            <Button onClick={handleAddAsset} className="w-full">Add Asset</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
