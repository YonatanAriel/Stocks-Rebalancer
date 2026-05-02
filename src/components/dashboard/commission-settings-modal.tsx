"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateCommissionSettings } from "@/actions/portfolio";
import { toast } from "sonner";

export function CommissionSettingsModal({
  open,
  onOpenChange,
  portfolioId,
  currentPercentage,
  currentMinimum,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  currentPercentage: number;
  currentMinimum: number;
  onUpdate?: (percentage: number, minimum: number) => void;
}) {
  const [percentage, setPercentage] = useState(currentPercentage.toString());
  const [minimum, setMinimum] = useState(currentMinimum.toString());
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const pct = parseFloat(percentage) || 0;
    const min = parseFloat(minimum) || 0;

    if (pct < 0 || min < 0) {
      toast.error("Commission values cannot be negative");
      return;
    }

    setLoading(true);
    try {
      await updateCommissionSettings(portfolioId, pct, min);
      onUpdate?.(pct, min);
      toast.success("Commission settings updated");
      onOpenChange(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update commission settings";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-[0.2em]">
            Commission Settings
          </DialogTitle>
          <DialogDescription className="text-[10px] uppercase font-bold tracking-widest opacity-60">
            Configure buying commission for Israeli stocks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="commission-pct" className="text-xs font-black uppercase tracking-widest">
              Commission Percentage (%)
            </Label>
            <div className="relative">
              <Input
                id="commission-pct"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.06"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">
                %
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
              e.g., 0.06 for 0.06%, 0.25 for 0.25%
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="commission-min" className="text-xs font-black uppercase tracking-widest">
              Minimum Commission (₪)
            </Label>
            <div className="relative">
              <Input
                id="commission-min"
                type="number"
                min="0"
                step="0.01"
                placeholder="2"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-8"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">
                ₪
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
              Minimum commission amount in shekels
            </p>
          </div>

          <div className="bg-primary/5 border border-primary/20 p-4 rounded-none space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              Example Calculation
            </p>
            <p className="text-[9px] text-muted-foreground">
              For a ₪1,000 buy with {percentage || "0"}% and ₪{minimum || "0"} minimum:
            </p>
            <p className="text-[9px] font-mono font-black text-primary">
              Commission = max(₪{(1000 * (parseFloat(percentage) || 0) / 100).toFixed(2)}, ₪{minimum || "0"})
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
