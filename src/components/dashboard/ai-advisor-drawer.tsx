"use client";

import { useState } from "react";
import { getSmartAdvice } from "@/actions/ai-advisor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AIAdvisorDrawerProps {
  portfolio: Array<{ ticker: string; value: number; targetPercent: number }>;
  cashAmount: number;
  onApply: (allocations: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAdvisorDrawer({
  portfolio,
  cashAmount,
  onApply,
  open,
  onOpenChange,
}: AIAdvisorDrawerProps) {
  const [streamedText, setStreamedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetAdvice = async () => {
    setIsLoading(true);
    setError(null);
    setStreamedText("");

    try {
      const result = await getSmartAdvice(portfolio, cashAmount);

      for await (const chunk of result.textStream) {
        setStreamedText((prev) => prev + chunk);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Error getting advice:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Smart Rebalance Advisor
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {!streamedText && !isLoading && !error && (
            <div className="text-center py-12">
              <div className="mb-4">
                <Sparkles className="w-12 h-12 text-blue-600 mx-auto opacity-50" />
              </div>
              <p className="text-gray-600 mb-4">
                Get AI-powered allocation suggestions based on real-time market data
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Analyzes technical indicators (RSI, MACD) and market sentiment
              </p>
              <Button onClick={handleGetAdvice} size="lg" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Analyze Portfolio
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600">Analyzing market data...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-semibold mb-2">Error</p>
              <p className="text-sm text-red-600">{error}</p>
              <Button
                onClick={handleGetAdvice}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          )}

          {streamedText && (
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{streamedText}</p>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => onApply(streamedText)} className="flex-1">
                  Apply Allocation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
