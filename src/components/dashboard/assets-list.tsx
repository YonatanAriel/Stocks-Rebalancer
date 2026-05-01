"use client";

import { createPortal } from "react-dom";

import { useRouter, useSearchParams } from "next/navigation";
import { updateAsset, deleteAsset, addAsset, toggleAssetActive, reorderAssets, updatePortfolio } from "@/actions/portfolio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import type { AssetWithValue, Asset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pencil, X, RefreshCw } from "lucide-react";
import { getAssetPrice } from "@/actions/finance";
import { StockDetailModal } from "@/components/stock-detail-modal";

function AssetRow({ 
  asset, 
  name,
  totalValue, 
  onEdit, 
  onDelete,
  isExcluded,
  onToggleExclude,
  onAssetClick,
  onDeleteClick,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop
}: { 
  asset: AssetWithValue & { priceSource?: 'manual' | 'scraped' }, 
  name?: string,
  totalValue: number, 
  onEdit: (a: Asset) => void,
  onDelete: (id: string) => void,
  isExcluded?: boolean,
  onToggleExclude?: () => void,
  onAssetClick?: (asset: AssetWithValue) => void,
  onDeleteClick?: (id: string, ticker: string) => void,
  isDragging?: boolean,
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void,
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void,
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
}) {
  const currentPct = totalValue > 0 ? ((asset.currentValue || 0) / totalValue) * 100 : 0;
  const diff = currentPct - asset.target_percentage;
  const isManualPrice = asset.priceSource === 'manual';
  
  // Calculate price per slice
  let pricePerSlice = asset.price;
  let isEstimated = false;
  if (pricePerSlice === null && asset.shares_owned > 0 && (asset.currentValue || 0) > 0) {
    pricePerSlice = (asset.currentValue || 0) / asset.shares_owned;
    isEstimated = true;
  }

  return (
    <>
      
      <div 
        className={`hidden mobile:grid grid-cols-[30px_1fr_100px_120px_100px_120px_60px_50px] gap-6 items-center p-6 mobile:p-4 bg-background/50 hover:bg-primary/[0.03] transition-all group border-b border-border last:border-0 ${isExcluded ? 'opacity-50' : ''} ${isDragging ? 'opacity-50 bg-primary/10' : ''} relative cursor-grab active:cursor-grabbing  `}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="flex items-center justify-center text-muted-foreground opacity-10 group-hover:opacity-40 transition-opacity">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <div 
          className="flex flex-col min-w-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onAssetClick?.(asset);
          }}
        >
          <span className={`text-base font-black uppercase tracking-tight truncate text-foreground group-hover:text-primary transition-colors font-heading ${isExcluded ? 'line-through' : ''}`}>{asset.ticker}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest truncate opacity-50">{name || "NO METADATA"}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-foreground font-mono">{asset.target_percentage}%</div>
          <div className={cn("text-[10px] font-black uppercase tracking-tighter font-mono", diff > 2 ? "text-orange-400" : diff < -2 ? "text-blue-400" : "text-primary")}>
            {currentPct.toFixed(2)}%
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-sm font-black font-mono text-foreground">
            {pricePerSlice !== null ? `₪${pricePerSlice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mt-0.5" />
            )}
          </div>
          {isEstimated && <span className="text-[8px] text-orange-400 font-black uppercase tracking-widest italic mt-0.5">estimated</span>}
          {isManualPrice && <span className="text-[8px] text-primary font-black uppercase tracking-widest mt-0.5">manual</span>}
        </div>
        <div className="text-right text-sm font-black font-mono text-muted-foreground">{asset.shares_owned}</div>
        <div className="text-right flex flex-col items-end">
          <div className="text-sm font-black text-foreground font-mono">
            {pricePerSlice !== null ? `₪${(asset.currentValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mt-0.5" />
            )}
          </div>
          {isManualPrice && <span className="text-[8px] text-primary font-black uppercase tracking-widest mt-0.5">manual</span>}
        </div>
        <div className="flex justify-end gap-2 z-40">
          <button 
            type="button"
            className="h-10 w-10 rounded-none opacity-0 group-hover:opacity-100 border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer flex items-center justify-center" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Edit button clicked for", asset.ticker);
              onEdit(asset);
            }}
            style={{ pointerEvents: 'auto' }}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button 
            type="button"
            className="h-10 w-10 rounded-none opacity-0 group-hover:opacity-100 text-destructive border border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all cursor-pointer flex items-center justify-center" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Delete button clicked for", asset.ticker);
              onDeleteClick?.(asset.id, asset.ticker);
            }}
            style={{ pointerEvents: 'auto' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleExclude?.();
          }}
          className={`h-10 rounded-none opacity-0 group-hover:opacity-100 border font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer ${
            isExcluded
              ? 'bg-destructive/20 border-destructive/50 text-destructive'
              : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
          }`}
          style={{ pointerEvents: 'auto' }}
        >
          {isExcluded ? 'OFF' : 'ON'}
        </button>
      </div>

      
      <div 
        className={`mobile:hidden flex flex-col p-4 bg-background/50 hover:bg-primary/[0.03] transition-all group border-b border-border last:border-0 ${isExcluded ? 'opacity-50' : ''} ${isDragging ? 'opacity-50 bg-primary/10' : ''} relative cursor-grab active:cursor-grabbing`}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        
        <div className="flex items-center justify-between gap-3 mb-2">
          <div 
            className="flex flex-col min-w-0 flex-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onAssetClick?.(asset);
            }}
          >
            <span className={`text-lg font-black uppercase tracking-tight truncate text-foreground group-hover:text-primary transition-colors font-heading ${isExcluded ? 'line-through' : ''}`}>{asset.ticker}</span>
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest truncate opacity-50">{name || "NO METADATA"}</span>
          </div>
          
          <div className="flex flex-col items-end flex-shrink-0">
            <div className="text-lg font-black text-foreground font-mono">
              {pricePerSlice !== null ? `₪${(asset.currentValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
              )}
            </div>
            {isManualPrice && <span className="text-[7px] text-primary font-black uppercase tracking-widest">manual</span>}
          </div>

          
          <div className="hidden xs:flex gap-1.5 z-40 flex-shrink-0">
            <button 
              type="button"
              className="h-8 w-8 rounded-none mobile:opacity-0 mobile:group-hover:opacity-100 border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer flex items-center justify-center" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(asset);
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button 
              type="button"
              className="h-8 w-8 rounded-none mobile:opacity-0 mobile:group-hover:opacity-100 text-destructive border border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all cursor-pointer flex items-center justify-center" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteClick?.(asset.id, asset.ticker);
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        
        <div className="grid grid-cols-3 xs:grid-cols-4 gap-3 text-[9px] uppercase font-black tracking-widest mb-2 xs:mb-0">
          <div className="flex flex-col">
            <span className="text-muted-foreground opacity-50 mb-0.5">Weight</span>
            <span className="text-foreground font-mono">{asset.target_percentage}%</span>
            <span className={cn("text-[8px] font-mono", diff > 2 ? "text-orange-400" : diff < -2 ? "text-blue-400" : "text-primary")}>
              {currentPct.toFixed(2)}%
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground opacity-50 mb-0.5">Price</span>
            <span className="text-foreground font-mono text-[9px] flex items-center h-4">
              {pricePerSlice !== null ? `₪${pricePerSlice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </span>
            {isEstimated && <span className="text-[7px] text-orange-400 italic">est</span>}
            {isManualPrice && <span className="text-[7px] text-primary">manual</span>}
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground opacity-50 mb-0.5">Units</span>
            <span className="text-foreground font-mono">{asset.shares_owned}</span>
          </div>
          
          
          <div className="hidden xs:flex flex-col items-end">
            <span className="text-muted-foreground opacity-50 mb-0.5">Status</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleExclude?.();
              }}
              className={`h-6 px-2 rounded-none border font-black text-[8px] uppercase tracking-widest transition-all cursor-pointer ${
                isExcluded
                  ? 'bg-destructive/20 border-destructive/50 text-destructive'
                  : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
              }`}
              style={{ pointerEvents: 'auto' }}
            >
              {isExcluded ? 'OFF' : 'ON'}
            </button>
          </div>
        </div>

        
        <div className="flex xs:hidden items-center justify-between gap-2">
          <div className="flex gap-1.5 z-40">
            <button 
              type="button"
              className="h-8 w-8 rounded-none text-destructive border border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all cursor-pointer flex items-center justify-center" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteClick?.(asset.id, asset.ticker);
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button 
              type="button"
              className="h-8 w-8 rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer flex items-center justify-center" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(asset);
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExclude?.();
            }}
            className={`h-8 px-3 rounded-none border font-black text-[8px] uppercase tracking-widest transition-all cursor-pointer ${
              isExcluded
                ? 'bg-destructive/20 border-destructive/50 text-destructive'
                : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
            }`}
            style={{ pointerEvents: 'auto' }}
          >
            {isExcluded ? 'OFF' : 'ON'}
          </button>
        </div>
      </div>
    </>
  );
}

export function AssetsList({ 
  portfolioId, 
  assets, 
  totalValue,
  portfolioName,
  names = {},
  loadingPrices,
  onRefresh,
  showCalculator,
  onToggleCalculator,
  excludedAssets = new Set(),
  onExcludedAssetsChange,
  onAssetAdded,
  onAssetPriceUpdated,
  onAssetUpdated,
  onAssetDeleted,
  onAssetRestore,
  onReorder
}: { 
  portfolioId: string, 
  assets: AssetWithValue[], 
  totalValue: number,
  portfolioName: string,
  names?: Record<string, string>,
  loadingPrices?: boolean,
  onRefresh?: () => void,
  showCalculator?: boolean,
  onToggleCalculator?: () => void,
  excludedAssets?: Set<string>,
  onExcludedAssetsChange?: (excluded: Set<string>) => void,
  onAssetAdded?: (ticker: string, price: number | null, name: string | null, percentage: number, shares: number) => void,
  onAssetPriceUpdated?: (assetId: string, ticker: string, price: number | null, name: string | null) => void,
  onAssetUpdated?: (asset: Asset) => void,
  onAssetDeleted?: (id: string) => void,
  onAssetRestore?: (asset: AssetWithValue) => void,
  onReorder?: (assets: AssetWithValue[]) => void
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [editManualValue, setEditManualValue] = useState<string>("");
  const [addingAsset, setAddingAsset] = useState(false);
  const [isAddingAssetLoading, setIsAddingAssetLoading] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newShares, setNewShares] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'value' | 'ticker' | 'weight' | 'price' | 'shares' | 'order' | 'status'>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSearch, setShowSearch] = useState(false);
  const [searchClicked, setSearchClicked] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetWithValue | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; ticker: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [netDetailsOpen, setNetDetailsOpen] = useState(false);
  const [netDetailsPinned, setNetDetailsPinned] = useState(false);
  const [netDetailsPos, setNetDetailsPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const netDetailsRef = useRef<HTMLDivElement>(null);


  const openNetDetails = (el: HTMLElement, pinned?: boolean) => {
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 300;
    const padding = 16;
    
    let left = rect.left;
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }
    
    setNetDetailsPos({ top: rect.bottom + 8, left });
    if (pinned) setNetDetailsPinned(true);
    setNetDetailsOpen(true);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (netDetailsOpen && netDetailsRef.current && !netDetailsRef.current.contains(event.target as Node)) {
        setNetDetailsOpen(false);
        setNetDetailsPinned(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [netDetailsOpen]);


  const [editingPortfolioName, setEditingPortfolioName] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState(portfolioName);
  const [isUpdatingPortfolioName, setIsUpdatingPortfolioName] = useState(false);

  const handleUpdatePortfolioName = async () => {
    if (newPortfolioName.trim() && newPortfolioName !== portfolioName) {
      setIsUpdatingPortfolioName(true);
      try {
        await updatePortfolio(portfolioId, { name: newPortfolioName.trim() });
        toast.success("Portfolio name updated");
      } catch (error) {
        toast.error("Failed to update name");
        setNewPortfolioName(portfolioName);
      } finally {
        setIsUpdatingPortfolioName(false);
      }
    }
    setEditingPortfolioName(false);
  };

  const handlePortfolioNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUpdatePortfolioName();
    if (e.key === 'Escape') {
      setNewPortfolioName(portfolioName);
      setEditingPortfolioName(false);
    }
  };

  const isIsraeli = (ticker: string) => /^\d{6,8}$/.test(ticker);
  
  const israeliActive = assets.filter(a => isIsraeli(a.ticker) && !excludedAssets.has(a.ticker)).reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const israeliTotal = assets.filter(a => isIsraeli(a.ticker)).reduce((sum, a) => sum + (a.currentValue || 0), 0);

  const intlActive = assets.filter(a => !isIsraeli(a.ticker) && !excludedAssets.has(a.ticker)).reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const intlTotal = assets.filter(a => !isIsraeli(a.ticker)).reduce((sum, a) => sum + (a.currentValue || 0), 0);

  const allActive = israeliActive + intlActive;
  const allTotal = israeliTotal + intlTotal;

  const renderNetDetailsTooltip = () => {
    if (!netDetailsOpen) return null;
    return createPortal(
      <div 
        ref={netDetailsRef}
        className="fixed z-[9999] border border-border bg-background shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-5 min-w-[300px] max-w-[calc(100vw-32px)] cursor-default text-left pointer-events-auto" 
        style={{ 
          top: netDetailsPos.top,
          left: netDetailsPos.left,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-baseline mb-4 pb-2 border-b border-border">
          <h3 className="font-heading font-black tracking-widest text-[10px] uppercase text-primary">Exposure Breakdown</h3>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">Active / Total</span>
        </div>
        <div className="space-y-4 font-mono text-xs normal-case tracking-normal">
          <div className="flex justify-between items-center">
            <span className="uppercase text-[10px] tracking-widest font-black text-muted-foreground">Israeli</span>
            <span>
              <span className="text-primary font-black">₪{israeliActive.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
              <span className="text-muted-foreground/40 mx-2">/</span>
              <span className="text-foreground/80">₪{israeliTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="uppercase text-[10px] tracking-widest font-black text-muted-foreground">Global</span>
            <span>
              <span className="text-primary font-black">₪{intlActive.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
              <span className="text-muted-foreground/40 mx-2">/</span>
              <span className="text-foreground/80">₪{intlTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
            </span>
          </div>
          <div className="flex justify-between items-center pt-3 mt-1 border-t border-border">
            <span className="uppercase text-[10px] tracking-widest font-black text-muted-foreground">Total</span>
            <span className="font-black">
              <span className="text-primary">₪{allActive.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
              <span className="text-muted-foreground/40 mx-2">/</span>
              <span className="text-foreground">₪{allTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
            </span>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dragOverAssetId, setDragOverAssetId] = useState<string | null>(null);
  const [orderedAssets, setOrderedAssets] = useState<AssetWithValue[]>(assets);
  
  // Refs for auto-focus
  const editPercentageRef = useRef<HTMLInputElement>(null);
  const newTickerRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync ordered assets when assets prop changes
  useEffect(() => {
    setOrderedAssets(assets);
  }, [assets]);

  // Sync mobile search
  useEffect(() => {
    const handleMobileSearch = ((e: CustomEvent<string>) => {
      setSearchQuery(e.detail);
    }) as EventListener;
    window.addEventListener('mobile-search', handleMobileSearch);
    return () => window.removeEventListener('mobile-search', handleMobileSearch);
  }, []);

  // Helper functions for URL management
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

  // Handle Add Modal
  useEffect(() => {
    const modal = searchParams.get('modal');
    if (modal === 'add') {
      setAddingAsset(true);
    } else {
      setAddingAsset(false);
    }
  }, [searchParams]); // REMOVED `assets` from dependencies

  // Handle Detail and Edit Modals which depend on assets
  useEffect(() => {
    const modal = searchParams.get('modal');
    const assetId = searchParams.get('assetId');
    const ticker = searchParams.get('ticker');

    if (modal === 'detail' && ticker) {
      const asset = assets.find(a => a.ticker === ticker);
      if (asset) setSelectedAsset(asset);
    } else {
      setSelectedAsset(null);
    }

    if (modal === 'edit' && assetId) {
      const asset = assets.find(a => a.id === assetId);
      if (asset) {
        setEditingAsset(asset);
        setEditShares(String(asset.shares_owned));
        setEditPercentage(String(asset.target_percentage));
        const manualValue = asset.manual_price_override && asset.manual_price_set_at 
          ? asset.manual_price_override * asset.shares_owned 
          : null;
        setEditManualValue(manualValue ? String(manualValue) : "");
      }
    } else {
      setEditingAsset(null);
    }
  }, [searchParams, assets]);

  // Global Escape key handler for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAddingAsset(false);
        setEditingAsset(null);
        setSelectedAsset(null);
        setDeleteConfirm(null);
        setSearchClicked(false);
        setSearchQuery("");
        setNetDetailsPinned(false);
        setNetDetailsOpen(false);
        updateURL({ modal: null, assetId: null, ticker: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleUpdateAsset() {
    if (!editingAsset) return;

    const optimisticAsset = { 
      ...editingAsset, 
      shares_owned: parseFloat(editShares) || 0,
      target_percentage: parseFloat(editPercentage) || 0,
    } as Asset;

    if (editManualValue) {
      const totalValue = parseFloat(editManualValue);
      const shares = optimisticAsset.shares_owned;
      if (shares > 0) {
        optimisticAsset.manual_price_override = totalValue / shares;
        optimisticAsset.manual_price_set_at = new Date().toISOString();
      }
    } else {
      optimisticAsset.manual_price_override = null;
      optimisticAsset.manual_price_set_at = null;
    }

    onAssetUpdated?.(optimisticAsset);
    setEditingAsset(null);
    setEditManualValue("");
    updateURL({ modal: null, assetId: null });

    try {
      await updateAsset(editingAsset.id, {
        shares_owned: optimisticAsset.shares_owned,
        target_percentage: optimisticAsset.target_percentage,
        manual_price_override: optimisticAsset.manual_price_override,
        manual_price_set_at: optimisticAsset.manual_price_set_at,
      });
      toast.success("Asset updated");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Update failed");
      router.refresh();
    }
  }

  async function handleDeleteAsset(id: string) {
    if (id.startsWith('temp-')) {
      window.location.reload();
      return;
    }
    
    try {
      await deleteAsset(id);
      toast.success("Asset removed");
      onAssetDeleted?.(id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  useEffect(() => {
    const handleOpenAdd = () => setAddingAsset(true);
    window.addEventListener('open-add-asset', handleOpenAdd);
    return () => {
      window.removeEventListener('open-add-asset', handleOpenAdd);
    };
  }, []);

  // Auto-focus for Edit Asset Modal
  useEffect(() => {
    if (editingAsset) {
      setTimeout(() => editPercentageRef.current?.focus(), 100);
    }
  }, [editingAsset]);

  // Auto-focus for Add Asset Modal
  useEffect(() => {
    if (addingAsset) {
      setTimeout(() => newTickerRef.current?.focus(), 100);
    }
  }, [addingAsset]);

  // Auto-focus for Search Bar
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearch]);

  async function handleAddAsset() {
    if (!newTicker.trim()) return;
    
    const ticker = newTicker.trim();
    const percentage = parseFloat(newPercentage) || 0;
    const shares = parseFloat(newShares) || 0;
    
    // Create a unique ID for this asset (for tracking)
    const tempId = `temp-${Date.now()}`;
    
    // First, close modal and add asset with loading state (synchronous)
    setAddingAsset(false);
    setNewTicker("");
    setNewPercentage("");
    setNewShares("");
    updateURL({ modal: null });
    
    // Add the asset immediately with no price (shows loading state)
    onAssetAdded?.(ticker, null, ticker, percentage, shares);
    
    try {
      // Fetch price in background
      const { name, price } = await getAssetPrice(ticker);
      onAssetPriceUpdated?.(tempId, ticker, price, name);
      await addAsset(portfolioId, ticker, percentage, shares, name || undefined);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Add failed");
      onAssetPriceUpdated?.(tempId, ticker, null, null);
    }
  }

  const currentEditingPrice = editingAsset ? assets.find(a => a.id === editingAsset.id)?.price : null;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, assetId: string) => {
    setDraggedAssetId(assetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, assetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverAssetId(assetId);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetAssetId: string) => {
    e.preventDefault();
    if (!draggedAssetId || draggedAssetId === targetAssetId) {
      setDraggedAssetId(null);
      setDragOverAssetId(null);
      return;
    }

    // Reorder the assets
    const draggedIndex = sortedAssets.findIndex(a => a.id === draggedAssetId);
    const targetIndex = sortedAssets.findIndex(a => a.id === targetAssetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedAssetId(null);
      setDragOverAssetId(null);
      return;
    }

    const newOrder = [...sortedAssets];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    // Update local state immediately for responsive UI - update both orderedAssets and display_order
    const updatedAssets = newOrder.map((asset, index) => ({
      ...asset,
      display_order: index
    }));
    setOrderedAssets(updatedAssets);
    setSortBy('order');
    setSortOrder('asc');
    onReorder?.(updatedAssets);

    // Persist to database
    try {
      await reorderAssets(updatedAssets.map(a => a.id));
      toast.success("Order updated");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Reorder failed");
      // Revert on error
      setOrderedAssets(sortedAssets);
    }

    setDraggedAssetId(null);
    setDragOverAssetId(null);
  };

  const handleDragEnd = () => {
    setDraggedAssetId(null);
    setDragOverAssetId(null);
  };
  const filteredAssets = orderedAssets.filter(asset => {
    const searchLower = searchQuery.toLowerCase();
    return asset.ticker.toLowerCase().includes(searchLower) || 
           (names[asset.ticker]?.toLowerCase().includes(searchLower) ?? false);
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    let aVal: any, bVal: any;
    
    if (sortBy === 'value') {
      aVal = a.currentValue || 0;
      bVal = b.currentValue || 0;
    } else if (sortBy === 'ticker') {
      aVal = a.ticker;
      bVal = b.ticker;
      return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    } else if (sortBy === 'weight') {
      aVal = a.target_percentage;
      bVal = b.target_percentage;
    } else if (sortBy === 'price') {
      aVal = a.price || 0;
      bVal = b.price || 0;
    } else if (sortBy === 'shares') {
      aVal = a.shares_owned;
      bVal = b.shares_owned;
    } else if (sortBy === 'status') {
      aVal = excludedAssets.has(a.ticker) ? 1 : 0;
      bVal = excludedAssets.has(b.ticker) ? 1 : 0;
    } else if (sortBy === 'order') {
      // Check if any asset has a display_order set
      const hasDisplayOrder = filteredAssets.some(asset => asset.display_order !== null && asset.display_order !== undefined);
      
      if (hasDisplayOrder) {
        // Use display_order if set
        aVal = a.display_order || 0;
        bVal = b.display_order || 0;
      } else {
        // Default: ON status first (sorted by value desc), then OFF status (sorted by value desc)
        const aIsExcluded = excludedAssets.has(a.ticker);
        const bIsExcluded = excludedAssets.has(b.ticker);
        
        // If different statuses, ON comes first
        if (aIsExcluded !== bIsExcluded) {
          return aIsExcluded ? 1 : -1;
        }
        
        // Same status, sort by value descending
        aVal = a.currentValue || 0;
        bVal = b.currentValue || 0;
        return bVal - aVal;
      }
    }
    
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden bg-background/40 border-border rounded-none shadow-2xl backdrop-blur-xl relative group">
        
        
        <CardHeader className="flex-shrink-0 space-y-6 p-6 pt-0 pr-0 sm-mobile:py-0 border-b border-border relative z-50">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-1 flex-1 min-w-0">
              
              <div className="hidden mobile:flex items-center gap-3 min-w-0">
                <div className="h-6 w-1 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] flex-shrink-0" />
                {editingPortfolioName ? (
                  <Input
                    autoFocus
                    value={newPortfolioName}
                    onChange={e => setNewPortfolioName(e.target.value)}
                    onBlur={handleUpdatePortfolioName}
                    onKeyDown={handlePortfolioNameKeyDown}
                    disabled={isUpdatingPortfolioName}
                    className="text-2xl font-black uppercase tracking-[0.2em] text-primary h-8 max-w-[300px] font-heading"
                  />
                ) : (
                  <CardTitle 
                    className="text-2xl font-black uppercase tracking-[0.2em] text-primary text-glow font-heading whitespace-nowrap cursor-text hover:opacity-80 transition-opacity"
                    onClick={() => setEditingPortfolioName(true)}
                  >
                    {portfolioName}
                  </CardTitle>
                )}
              </div>
              <div className="hidden mobile:flex items-center gap-3 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-60">
                <span className="flex items-center gap-1.5 text-primary">
                  <span className="h-1.5 w-1.5 bg-primary animate-pulse" />
                  SYNCED
                </span>
                <span>•</span>
                <span>{assets.length} UNITS</span>
                <span>•</span>
                <span 
                  className="text-foreground font-mono relative cursor-pointer hover:text-primary transition-colors pointer-events-auto"
                  onMouseEnter={(e) => !netDetailsPinned && openNetDetails(e.currentTarget)}
                  onMouseLeave={() => !netDetailsPinned && setNetDetailsOpen(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    openNetDetails(e.currentTarget, true);
                  }}
                >
                  Σ ₪{totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  {renderNetDetailsTooltip()}
                </span>
              </div>

              
              <div className="hidden sm-mobile:flex mobile:hidden items-center justify-between gap-3 min-w-0 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-5 w-1 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] flex-shrink-0" />
                  {editingPortfolioName ? (
                    <Input
                      autoFocus
                      value={newPortfolioName}
                      onChange={e => setNewPortfolioName(e.target.value)}
                      onBlur={handleUpdatePortfolioName}
                      onKeyDown={handlePortfolioNameKeyDown}
                      disabled={isUpdatingPortfolioName}
                      className="text-lg font-black uppercase tracking-[0.2em] text-primary h-7 max-w-[200px] font-heading"
                    />
                  ) : (
                    <CardTitle 
                      className="text-lg font-black uppercase tracking-[0.2em] text-primary text-glow font-heading whitespace-nowrap cursor-text hover:opacity-80 transition-opacity"
                      onClick={() => setEditingPortfolioName(true)}
                    >
                      {portfolioName}
                    </CardTitle>
                  )}
                  <div className="flex items-center gap-2 text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-60">
                    <span className="flex items-center gap-1.5 text-primary">
                      <span className="h-1.5 w-1.5 bg-primary animate-pulse" />
                      SYNCED
                    </span>
                    <span>•</span>
                    <span>{assets.length} UNITS</span>
                    <span>•</span>
                    <span 
                      className="text-foreground font-mono relative cursor-pointer hover:text-primary transition-colors pointer-events-auto"
                      onMouseEnter={(e) => !netDetailsPinned && openNetDetails(e.currentTarget)}
                      onMouseLeave={() => !netDetailsPinned && setNetDetailsOpen(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        openNetDetails(e.currentTarget, true);
                      }}
                    >
                      Σ ₪{totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      {renderNetDetailsTooltip()}
                    </span>
                  </div>
                </div>
                
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAddingAsset(true);
                    updateURL({ modal: 'add' });
                  }}
                  className="h-10 px-4 xs:px-3 rounded-none bg-background border border-primary hover:bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  style={{ pointerEvents: 'auto' }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden xs:inline">NEW</span>
                </button>
              </div>

              
              <div className="flex sm-mobile:hidden items-center justify-between gap-3 min-w-0">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-5 w-1 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] flex-shrink-0" />
                    {editingPortfolioName ? (
                      <Input
                        autoFocus
                        value={newPortfolioName}
                        onChange={e => setNewPortfolioName(e.target.value)}
                        onBlur={handleUpdatePortfolioName}
                        onKeyDown={handlePortfolioNameKeyDown}
                        disabled={isUpdatingPortfolioName}
                        className="text-base font-black uppercase tracking-[0.15em] text-primary h-7 max-w-[180px] font-heading"
                      />
                    ) : (
                      <CardTitle 
                        className="text-base font-black uppercase tracking-[0.15em] text-primary text-glow font-heading whitespace-nowrap cursor-text hover:opacity-80 transition-opacity"
                        onClick={() => setEditingPortfolioName(true)}
                      >
                        {portfolioName}
                      </CardTitle>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-60 ml-3">
                    <span className="flex items-center gap-1 text-primary">
                      <span className="h-1.5 w-1.5 bg-primary animate-pulse" />
                      SYNCED
                    </span>
                    <span>•</span>
                    <span>{assets.length} UNITS</span>
                    <span>•</span>
                    <span 
                      className="text-foreground font-mono relative cursor-pointer hover:text-primary transition-colors pointer-events-auto"
                      onMouseEnter={(e) => !netDetailsPinned && openNetDetails(e.currentTarget)}
                      onMouseLeave={() => !netDetailsPinned && setNetDetailsOpen(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        openNetDetails(e.currentTarget, true);
                      }}
                    >
                      Σ ₪{totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      {renderNetDetailsTooltip()}
                    </span>
                  </div>
                </div>
                
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAddingAsset(true);
                    updateURL({ modal: 'add' });
                  }}
                  className="h-10 px-4 xs:px-3 rounded-none bg-background border border-primary hover:bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  style={{ pointerEvents: 'auto' }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden xs:inline">NEW</span>
                </button>
              </div>
            </div>

            <div className="hidden mobile:flex pr-0 items-center gap-px bg-white/5 border border-border p-1 relative z-50 pointer-events-auto" style={{ pointerEvents: 'auto' }}>
              
              <div className="hidden mobile:flex items-center relative group overflow-hidden mr-auto" onMouseLeave={() => !searchQuery && !searchClicked && setShowSearch(false)}>
                <div className={`transition-all   duration-300 ease-out overflow-hidden ${showSearch ? 'w-48' : 'w-0'}`}>
                  <Input
                    ref={searchInputRef}
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchClicked) {
                        setShowSearch(false);
                      }
                    }}
                    className="h-12 w-48 bg-transparent border border-primary rounded-none text-[12px] placeholder:text-muted-foreground/50 px-4"
                    style={{ pointerEvents: 'auto' }}
                  />
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearchClicked(!searchClicked);
                    setShowSearch(!showSearch);
                  }}
                  onMouseEnter={() => !searchClicked && setShowSearch(true)}
                  className="rounded-none h-12 px-6 text-[12px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all cursor-pointer flex items-center flex-shrink-0 focus:outline-none"
                  style={{ pointerEvents: 'auto' }}
                  title="Search"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRefresh && onRefresh();
                }}
                disabled={loadingPrices}
                className="hidden mobile:flex rounded-none h-12 px-6 text-[12px] font-black uppercase tracking-widest gap-2 hover:bg-primary/10 transition-all cursor-pointer items-center justify-center"
                style={{ pointerEvents: 'auto' }}
              >
                <RefreshCw className={`h-4 w-4 ${loadingPrices ? "animate-spin" : ""}`} />
                {loadingPrices ? "SYNC" : "REFRESH"}
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleCalculator && onToggleCalculator();
                }}
                className="hidden mobile:flex rounded-none h-12 px-8 bg-primary hover:bg-primary/90 text-black font-black uppercase text-[12px] tracking-widest shadow-[4px_4px_0px_0px_rgba(var(--primary),0.3)] hover:shadow-none transition-all cursor-pointer items-center justify-center"
                style={{ pointerEvents: 'auto' }}
              >
                {showCalculator ? "CLOSE" : "REBALANCE"}
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAddingAsset(true);
                  updateURL({ modal: 'add' });
                }}
                className="hidden mobile:flex rounded-none h-12 px-6 text-[12px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border-l-2 border-border cursor-pointer items-center justify-center"
                style={{ pointerEvents: 'auto' }}
              >
                NEW
              </button>
            </div>
          </div>
        </CardHeader>

        
        <div className="hidden mobile:grid flex-shrink-0 grid-cols-[30px_1fr_100px_120px_100px_120px_60px_50px] gap-6  text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4 border-b border-border bg-white/[0.02] relative z-10 font-heading">
          <div className="flex items-center justify-center cursor-pointer hover:text-primary transition-colors group h-full" onClick={() => { setSortBy('order'); setSortOrder('asc'); }} title="Manual Order">
            <span className={cn("text-[12px] leading-none transition-all mr-3", sortBy === 'order' ? "text-primary" : "text-muted-foreground opacity-80 ")}>
              {sortBy === 'order' ? '■' : '□'}
            </span>
          </div>
          <div className={cn("flex items-center justify-between cursor-pointer hover:text-primary transition-colors group", sortBy === 'ticker' ? "text-primary" : "text-muted-foreground")} onClick={() => { setSortBy('ticker'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
            <span>Asset / Class</span>
            <span className="text-[8px] opacity-0 group-hover:opacity-100">{sortBy === 'ticker' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
          </div>
          <div className={cn("text-right flex items-center justify-end cursor-pointer hover:text-primary transition-colors group", sortBy === 'weight' ? "text-primary" : "text-muted-foreground")} onClick={() => { setSortBy('weight'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
            <span>Weight %</span>
            <span className="text-[8px] opacity-0 group-hover:opacity-100 ml-1">{sortBy === 'weight' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
          </div>
          <div className={cn("text-right flex items-center justify-end cursor-pointer hover:text-primary transition-colors group", sortBy === 'price' ? "text-primary" : "text-muted-foreground")} onClick={() => { setSortBy('price'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
            <span>Unit Rate</span>
            <span className="text-[8px] opacity-0 group-hover:opacity-100 ml-1">{sortBy === 'price' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
          </div>
          <div className={cn("text-right flex items-center justify-end cursor-pointer hover:text-primary transition-colors group", sortBy === 'shares' ? "text-primary" : "text-muted-foreground")} onClick={() => { setSortBy('shares'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
            <span>Inventory</span>
            <span className="text-[8px] opacity-0 group-hover:opacity-100 ml-1">{sortBy === 'shares' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
          </div>
          <div className={cn("text-right flex items-center justify-end cursor-pointer hover:text-primary transition-colors group", sortBy === 'value' ? "text-primary" : "text-muted-foreground")} onClick={() => { setSortBy('value'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
            <span>Net Value</span>
            <span className="text-[8px] opacity-0 group-hover:opacity-100 ml-1">{sortBy === 'value' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
          </div>
          <span />
          <div className={cn("text-center flex items-center justify-center cursor-pointer hover:text-primary transition-colors group", sortBy === 'status' ? "text-primary" : "text-muted-foreground")} onClick={() => { setSortBy('status'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
            <span>Status</span>
            <span className="text-[8px] opacity-0 group-hover:opacity-100 ml-1">{sortBy === 'status' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
          </div>
        </div>
        <CardContent 
          className="flex-1 overflow-y-auto custom-scrollbar touch-pan-y p-0 relative z-10"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          <div className="divide-y divide-border">
            {sortedAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                name={names[asset.ticker]}
                totalValue={totalValue}
                onEdit={(a) => {
                  setEditingAsset(a);
                  setEditShares(String(a.shares_owned));
                  setEditPercentage(String(a.target_percentage));
                  // Calculate total value from manual price override if it exists
                  const manualValue = a.manual_price_override && a.manual_price_set_at 
                    ? a.manual_price_override * a.shares_owned 
                    : null;
                  setEditManualValue(manualValue ? String(manualValue) : "");
                  updateURL({ modal: 'edit', assetId: a.id });
                }}
                onDelete={handleDeleteAsset}
                onDeleteClick={(id, ticker) => setDeleteConfirm({ id, ticker })}
                isExcluded={excludedAssets.has(asset.ticker)}
                isDragging={draggedAssetId === asset.id}
                onDragStart={(e) => handleDragStart(e, asset.id)}
                onDragOver={(e) => handleDragOver(e, asset.id)}
                onDrop={(e) => handleDrop(e, asset.id)}
                onToggleExclude={async () => {
                  const newExcluded = new Set(excludedAssets);
                  const isCurrentlyExcluded = newExcluded.has(asset.ticker);
                  
                  if (isCurrentlyExcluded) {
                    newExcluded.delete(asset.ticker);
                  } else {
                    newExcluded.add(asset.ticker);
                  }
                  
                  // Update local state immediately for responsive UI
                  onExcludedAssetsChange?.(newExcluded);
                  
                  // Persist to database (without refreshing the page)
                  try {
                    await toggleAssetActive(asset.id, isCurrentlyExcluded);
                  } catch (error) {
                    toast.error("Failed to update asset status");
                    // Revert on error
                    onExcludedAssetsChange?.(excludedAssets);
                  }
                }}
                onAssetClick={(asset) => {
                  setSelectedAsset(asset);
                  updateURL({ modal: 'detail', ticker: asset.ticker });
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => {
          setEditingAsset(null);
          updateURL({ modal: null, assetId: null });
        }}>
          <div className="max-w-md bg-background border border-border rounded-none p-0 overflow-hidden shadow-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10 space-y-10 relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-primary font-heading">Modify Position</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">
                  Updating {editingAsset?.ticker} parameters.
                </p>
              </div>
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Allocation (%)</Label>
                    <Input
                      ref={editPercentageRef}
                      type="number"
                      step="0.01"
                      value={editPercentage}
                      onChange={(e) => setEditPercentage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdateAsset();
                        }
                      }}
                      className="h-14 bg-white/[0.03] border-border focus:border-primary rounded-none font-black text-lg pointer-events-auto"
                      style={{ pointerEvents: 'auto' }}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Current Inventory</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editShares}
                      onChange={(e) => setEditShares(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdateAsset();
                        }
                      }}
                      className="h-14 bg-white/[0.03] border-border focus:border-primary rounded-none font-black text-lg pointer-events-auto"
                      style={{ pointerEvents: 'auto' }}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Manual Value Override (₪)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editManualValue}
                      onChange={(e) => setEditManualValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdateAsset();
                        }
                      }}
                      placeholder="Auto-calculate"
                      className="h-14 bg-white/[0.03] border-border focus:border-primary rounded-none font-black text-lg placeholder:text-white/10 pointer-events-auto"
                      style={{ pointerEvents: 'auto' }}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Update Registry clicked");
                    handleUpdateAsset();
                  }}
                  style={{ pointerEvents: 'auto' }}
                  className="w-full h-16 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.2em] rounded-none shadow-[8px_8px_0px_0px_rgba(var(--primary),0.3)] hover:shadow-none transition-all cursor-pointer"
                >
                  Update Registry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => {
          setAddingAsset(false);
          setNewTicker("");
          setNewPercentage("");
          setNewShares("");
          updateURL({ modal: null });
        }}>
          <div className="max-w-md bg-background border border-border rounded-none p-0 overflow-hidden shadow-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10 space-y-10 relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-primary font-heading">Initialize Asset</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">
                  Register a new unit into the index.
                </p>
              </div>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                }} 
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Ticker / Security ID</Label>
                    <Input 
                      ref={newTickerRef}
                      placeholder="e.g. 1159250" 
                      required 
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAsset();
                        }
                      }}
                      className="h-14 bg-white/[0.03] border-border focus:border-primary rounded-none font-black text-lg placeholder:text-white/10 pointer-events-auto"
                      style={{ pointerEvents: 'auto' }}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Allocation (%)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      value={newPercentage}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) <= 99 && val.length <= 2)) {
                          setNewPercentage(val);
                        }
                      }}
                      max={99}
                      min={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAsset();
                        }
                      }}
                      className="h-14 bg-white/[0.03] border-border focus:border-primary rounded-none font-black text-lg placeholder:text-white/10 pointer-events-auto"
                      style={{ pointerEvents: 'auto' }}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Current Inventory</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0" 
                      required 
                      value={newShares}
                      onChange={(e) => setNewShares(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAsset();
                        }
                      }}
                      className="h-14 bg-white/[0.03] border-border focus:border-primary rounded-none font-black text-lg placeholder:text-white/10 pointer-events-auto"
                      style={{ pointerEvents: 'auto' }}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => handleAddAsset()}
                  style={{ pointerEvents: 'auto' }}
                  className="w-full h-16 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.2em] rounded-none shadow-[8px_8px_0px_0px_rgba(var(--primary),0.3)] hover:shadow-none transition-all cursor-pointer"
                >
                  Finalize Registry
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      <StockDetailModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => {
          setSelectedAsset(null);
          updateURL({ modal: null, ticker: null });
        }}
        totalValue={totalValue}
        assetName={selectedAsset ? names[selectedAsset.ticker] : undefined}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div 
            ref={(el) => { if (el) setTimeout(() => el.focus(), 10) }}
            className="max-w-md w-full bg-background border-2 border-destructive rounded-none overflow-hidden shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                
                if (deleteConfirm.id.startsWith('temp-')) {
                  window.location.reload();
                  return;
                }
                
                const assetToRestore = assets.find(a => a.id === deleteConfirm.id);
                onAssetDeleted?.(deleteConfirm.id);
                setDeleteConfirm(null);
                deleteAsset(deleteConfirm.id).catch(err => {
                  console.error("Failed to delete asset:", err);
                  toast.error("Failed to delete asset");
                  if (assetToRestore) onAssetRestore?.(assetToRestore);
                });
              }
            }}
            tabIndex={0}
          >
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <h2 className="text-3xl font-black uppercase tracking-[0.3em] text-destructive font-heading">
                  Confirm Delete
                </h2>
                <p className="text-sm text-muted-foreground">
                  Remove <span className="text-foreground font-black">{deleteConfirm.ticker}</span> from portfolio?
                </p>
                <p className="text-xs text-destructive/70 uppercase tracking-widest font-black">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 h-14 bg-white/5 hover:bg-white/10 border border-border text-foreground font-black uppercase text-sm tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirm.id.startsWith('temp-')) {
                      window.location.reload();
                      return;
                    }
                    
                    const assetToRestore = assets.find(a => a.id === deleteConfirm.id);
                    onAssetDeleted?.(deleteConfirm.id);
                    setDeleteConfirm(null);
                    
                    deleteAsset(deleteConfirm.id).catch(err => {
                      console.error("Failed to delete asset:", err);
                      toast.error("Failed to delete asset");
                      if (assetToRestore) onAssetRestore?.(assetToRestore);
                    });
                  }}
                  className="flex-1 h-14 bg-destructive hover:bg-destructive/90 text-white font-black uppercase text-sm tracking-widest shadow-[4px_4px_0px_0px_rgba(239,68,68,0.3)] hover:shadow-none transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
