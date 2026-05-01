"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { getAssetPrice, fetchPricesInParallel } from "@/actions/finance";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prices, setPrices] = useState<PriceMap>({});
  const [priceSource, setPriceSource] = useState<Record<string, 'manual' | 'scraped'>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [cashAmount, setCashAmount] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAllocation, setShowAllocation] = useState(false);
  const [portfolioAssets, setPortfolioAssets] = useState(portfolio.assets);
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedAssets, setExcludedAssets] = useState<Set<string>>(() => {
    // Initialize from database
    const excluded = new Set<string>();
    portfolio.assets.forEach(asset => {
      if (asset.is_active === false) {
        excluded.add(asset.ticker);
      }
    });
    return excluded;
  });

  // Helper function for URL management
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

  // Sync URL params with calculator state
  useEffect(() => {
    const calculator = searchParams.get('calculator');
    if (calculator === 'open') {
      setShowCalculator(true);
    }
  }, [searchParams]);

  // Initialize names from portfolio data if available
  useEffect(() => {
    const initialNames: Record<string, string> = {};
    portfolio.assets.forEach(asset => {
      if (asset.name) initialNames[asset.ticker] = asset.name;
    });
    setNames(prev => ({ ...initialNames, ...prev }));
  }, [portfolio.assets]);

  // Initialize with manual prices from DB
  useEffect(() => {
    const initialPrices: PriceMap = {};
    const initialSource: Record<string, 'manual' | 'scraped'> = {};
    
    portfolio.assets.forEach((asset: any) => {
      if (asset?.manual_price_override && asset?.manual_price_set_at) {
        const minutesAgo = (Date.now() - new Date(asset.manual_price_set_at).getTime()) / 60000;
        if (minutesAgo < 15) {
          initialPrices[asset.ticker] = asset.manual_price_override;
          initialSource[asset.ticker] = 'manual';
        }
      }
    });
    
    setPrices(prev => ({ ...initialPrices, ...prev }));
    setPriceSource(prev => ({ ...initialSource, ...prev }));
  }, [portfolio.assets]);

  // Fetch all prices on mount with parallel requests
  const fetchPrices = useCallback(async () => {
    setLoadingPrices(true);

    try {
      // Extract all tickers
      const tickers = portfolioAssets.map(asset => asset.ticker);
      
      // Fetch all prices in parallel with concurrency limit
      const results = await fetchPricesInParallel(tickers);
      
      // Update state with all results at once
      const newPrices: PriceMap = {};
      const newPriceSource: Record<string, 'manual' | 'scraped'> = {};
      const newNames: Record<string, string> = {};
      
      Object.entries(results).forEach(([ticker, data]) => {
        if (data.price !== null) {
          newPrices[ticker] = data.price;
          newPriceSource[ticker] = data.isManual ? 'manual' : 'scraped';
        } else {
          newPrices[ticker] = 0;
          newPriceSource[ticker] = 'scraped';
        }
        if (data.name) {
          newNames[ticker] = data.name;
        }
      });
      
      setPrices(prev => ({ ...prev, ...newPrices }));
      setPriceSource(prev => ({ ...prev, ...newPriceSource }));
      setNames(prev => ({ ...prev, ...newNames }));
    } catch (e) {
      console.error('Failed to fetch prices', e);
    } finally {
      setLoadingPrices(false);
      setIsInitialLoad(false);
    }
  }, [portfolioAssets]); // Depend on portfolioAssets so it uses the latest

  useEffect(() => {
    fetchPrices();
  }, []); // Only run once on mount

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Refresh: Alt + R
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        fetchPrices();
      }
      // Calculator: Alt + C
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setShowCalculator(true);
        updateURL({ calculator: 'open' });
      }
      // Add Asset: Alt + A
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-add-asset'));
      }
      // Close Modals: Escape
      if (e.key === 'Escape') {
        setShowCalculator(false);
        setShowAllocation(false);
        updateURL({ calculator: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchPrices]);

  const assetsWithValues = useMemo(() => {
    return portfolioAssets.map((asset) => {
      const price = prices[asset.ticker] ?? null;
      const source = priceSource[asset.ticker] ?? 'scraped';
      // Calculate value from price × shares
      const currentValue = price !== null ? asset.shares_owned * price : null;
        
      return {
        ...asset,
        price,
        currentValue,
        priceSource: source,
      } as AssetWithValue & { priceSource: 'manual' | 'scraped' };
    });
  }, [portfolioAssets, prices, priceSource]);

  const totalValue = useMemo(() => {
    return assetsWithValues.reduce((sum, asset) => sum + (excludedAssets.has(asset.ticker) ? 0 : (asset.currentValue || 0)), 0);
  }, [assetsWithValues, excludedAssets]);

  return (
    <div className="h-[100dvh] flex flex-col bg-dot-pattern mesh-glow overflow-hidden">
      <DashboardHeader 
        userEmail={userEmail} 
        onRefresh={fetchPrices} 
        isLoading={loadingPrices}
        onNewAsset={() => {
          window.dispatchEvent(new CustomEvent('open-add-asset'));
        }}
        onRebalance={() => {
          setShowCalculator(true);
          updateURL({ calculator: 'open' });
        }}
        onAllocation={() => {
          setShowAllocation(true);
        }}
        onSearch={() => {
          // Search is handled in the header component itself
        }}
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full grid gap-8 grid-cols-1 portfolio:grid-cols-[1fr_350px] px-6 py-6 mobile:py-3 overflow-hidden">
          <div className="min-h-0 overflow-hidden">
            <AssetsList 
              assets={assetsWithValues} 
              totalValue={totalValue} 
              portfolioId={portfolio.id} 
              portfolioName={portfolio.name}
              names={names} 
              loadingPrices={loadingPrices}
              onRefresh={fetchPrices}
              showCalculator={showCalculator}
              onToggleCalculator={() => {
                const newState = !showCalculator;
                setShowCalculator(newState);
                updateURL({ calculator: newState ? 'open' : null });
              }}
              excludedAssets={excludedAssets}
              onExcludedAssetsChange={setExcludedAssets}
              onAssetAdded={(ticker, price, name, percentage, shares) => {
                // Add new asset to the list immediately
                const newAsset: any = {
                  id: `temp-${Date.now()}`, // Temporary ID until refresh
                  portfolio_id: portfolio.id,
                  ticker,
                  name,
                  target_percentage: percentage,
                  shares_owned: shares,
                  manual_price_override: null,
                  manual_price_set_at: null,
                  is_active: true,
                };
                setPortfolioAssets(prev => [...prev, newAsset]);
                
                // Update prices
                if (price) {
                  setPrices(prev => ({ ...prev, [ticker]: price }));
                  setPriceSource(prev => ({ ...prev, [ticker]: 'scraped' }));
                }
                if (name) {
                  setNames(prev => ({ ...prev, [ticker]: name || '' }));
                }
              }}
              onAssetPriceUpdated={(assetId, ticker, price, name) => {
                setPrices(prev => ({ ...prev, [ticker]: price !== null ? price : 0 }));
                setPriceSource(prev => ({ ...prev, [ticker]: 'scraped' }));
                
                if (name) {
                  setNames(prev => ({ ...prev, [ticker]: name }));
                  setPortfolioAssets(prev => prev.map(a => a.ticker === ticker ? { ...a, name } : a));
                }
              }}
              onAssetDeleted={(id) => {
                setPortfolioAssets(prev => prev.filter(a => a.id !== id));
              }}
              onAssetRestore={(asset) => {
                setPortfolioAssets(prev => [...prev, asset]);
              }}
              onReorder={(updatedAssets) => {
                setPortfolioAssets(updatedAssets as any);
              }}
            />
          </div>

          {/* Hide allocation chart on mobile (below 995px) */}
          <div className="hidden portfolio:flex min-h-0 flex-col overflow-hidden">
            <Card className="bg-background/40 border-border rounded-none shadow-xl border-t-4 border-primary backdrop-blur-xl flex flex-col h-full overflow-hidden">
            <CardHeader className="flex-shrink-0 p-6 border-b border-border bg-white/[0.01]">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary font-heading">Target Allocation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <AllocationChart
                assets={assetsWithValues
                  .filter(a => !excludedAssets.has(a.ticker))
                  .map((a) => ({
                    ticker: a.ticker,
                    name: a.name || names[a.ticker] || "",
                    targetPct: a.target_percentage,
                    currentPct: totalValue > 0 && a.currentValue ? (a.currentValue / totalValue) * 100 : 0,
                    priceSource: a.priceSource,
                  }))}
                isLoading={loadingPrices && isInitialLoad}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {showCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => {
          setShowCalculator(false);
          updateURL({ calculator: null });
        }}>
          <div className="max-w-5xl bg-background border-border rounded-none h-full mobile:h-auto mobile:max-h-[90vh] overflow-y-auto custom-scrollbar touch-pan-y p-0 w-full mobile:mx-4 pointer-events-auto relative" 
            onClick={(e) => e.stopPropagation()}
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
            <div className="sticky top-0 bg-background border-b border-border pt-8 pb-4 px-4 mobile:p-8 flex items-start justify-between gap-4 mobile:gap-8 z-10">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg mobile:text-xl font-black uppercase tracking-[0.1em] mobile:tracking-[0.4em] text-primary truncate">System Rebalance</h2>
                <p className="text-[10px] mobile:text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  Optimizing capital distribution based on target weights.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowCalculator(false);
                    updateURL({ calculator: null });
                  }}
                  className="rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all h-10 w-10 cursor-pointer flex items-center justify-center"
                  style={{ pointerEvents: 'auto' }}
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={fetchPrices}
                  disabled={loadingPrices}
                  className="rounded-none text-[9px] mobile:text-[10px] uppercase font-black tracking-widest border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all h-10 w-10 mobile:w-auto mobile:px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                  title="Refresh prices (Alt+R)"
                >
                  <svg className={`h-5 w-5 mobile:h-4 mobile:w-4 ${loadingPrices ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden mobile:inline">Refresh Prices</span>
                </button>
              </div>
            </div>
            <div className="p-4 mobile:p-8">
              <RebalanceCalculator
                assets={portfolio.assets}
                assetsWithValues={assetsWithValues}
                totalValue={totalValue}
                prices={prices}
                names={names}
                cashAmount={cashAmount}
                setCashAmount={setCashAmount}
                priceOverrides={priceOverrides}
                setPriceOverrides={setPriceOverrides}
                excludedAssets={excludedAssets}
                onExcludedAssetsChange={setExcludedAssets}
                onRefreshPrices={fetchPrices}
                isRefreshing={loadingPrices}
              />
            </div>
          </div>
        </div>
      )}

      {/* Allocation Chart Modal (for mobile) */}
      {showAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setShowAllocation(false)}>
          <div className="max-w-2xl w-full bg-background border border-border rounded-none max-h-[90vh] overflow-y-auto custom-scrollbar touch-pan-y mx-4 pointer-events-auto" 
            onClick={(e) => e.stopPropagation()}
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-[0.3em] text-primary font-heading">Target Allocation</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">
                  Portfolio distribution overview
                </p>
              </div>
              <button
                onClick={() => setShowAllocation(false)}
                className="rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all h-10 w-10 cursor-pointer flex items-center justify-center flex-shrink-0"
                style={{ pointerEvents: 'auto' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <AllocationChart
                assets={assetsWithValues
                  .filter(a => !excludedAssets.has(a.ticker))
                  .map((a) => ({
                    ticker: a.ticker,
                    targetPct: a.target_percentage,
                    currentPct: totalValue > 0 && a.currentValue ? (a.currentValue / totalValue) * 100 : 0,
                    priceSource: a.priceSource,
                  }))}
                isLoading={loadingPrices && isInitialLoad}
              />
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
