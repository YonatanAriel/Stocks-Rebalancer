"use client";

import { useEffect, useState } from "react";
import type { AssetWithValue, StockDetail } from "@/lib/types";
import { X } from "lucide-react";

interface StockDetailModalProps {
  asset: AssetWithValue | null;
  isOpen: boolean;
  onClose: () => void;
  totalValue: number;
  assetName?: string;
}

export function StockDetailModal(props: StockDetailModalProps) {
  const { asset, isOpen, onClose, totalValue, assetName } = props;
  const [detailData, setDetailData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isOpen && asset) {
      setLoading(true);
      fetch(`/api/stock-details/${asset.ticker}`)
        .then(res => res.json())
        .then(data => {
          setDetailData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch stock details:", err);
          setLoading(false);
        });
    }
  }, [isOpen, asset]);
  
  if (!isOpen || !asset) return null;
  
  const currentPct = totalValue > 0 ? ((asset.currentValue || 0) / totalValue) * 100 : 0;
  const deviation = currentPct - asset.target_percentage;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="max-w-2xl w-full bg-background border-2 border-primary rounded-none overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b-2 border-white/10 relative bg-primary/5">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center border border-white/20 hover:border-primary hover:bg-primary/10 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-primary font-heading">
              {asset.ticker}
            </h2>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-black">
              {assetName || detailData?.name || "Loading..."}
            </p>
            
            {!loading && detailData && (
              <div className="flex items-baseline gap-4 mt-4">
                <span className="text-4xl font-black font-mono text-foreground">
                  ₪{detailData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {detailData.changePercent !== undefined && (
                  <span className={`text-lg font-black font-mono ${detailData.changePercent >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {detailData.changePercent >= 0 ? '+' : ''}{detailData.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm uppercase tracking-widest font-black text-muted-foreground">
              Loading data...
            </p>
          </div>
        ) : (
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-2">
                Your Position
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Shares Owned
                  </div>
                  <div className="text-2xl font-black font-mono text-foreground">
                    {asset.shares_owned}
                  </div>
                </div>
                
                <div className="bg-white/[0.02] border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Current Value
                  </div>
                  <div className="text-2xl font-black font-mono text-foreground">
                    ₪{(asset.currentValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                
                <div className="bg-white/[0.02] border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Target %
                  </div>
                  <div className="text-2xl font-black font-mono text-foreground">
                    {asset.target_percentage}%
                  </div>
                </div>
                
                <div className="bg-white/[0.02] border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Current %
                  </div>
                  <div className={`text-2xl font-black font-mono ${Math.abs(deviation) > 2 ? 'text-orange-400' : 'text-primary'}`}>
                    {currentPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
            
            {detailData?.performance && Object.keys(detailData.performance).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-2">
                  Performance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {detailData.performance.oneMonth && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">1 Month</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.performance.oneMonth}</div>
                    </div>
                  )}
                  {detailData.performance.threeMonth && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">3 Months</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.performance.threeMonth}</div>
                    </div>
                  )}
                  {detailData.performance.ytd && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">YTD</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.performance.ytd}</div>
                    </div>
                  )}
                  {detailData.performance.oneYear && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">1 Year</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.performance.oneYear}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {detailData?.overview && Object.keys(detailData.overview).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-2">
                  Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {detailData.overview.marketCap && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Market Cap</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.overview.marketCap}</div>
                    </div>
                  )}
                  {detailData.overview.volume && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Volume</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.overview.volume}</div>
                    </div>
                  )}
                  {detailData.overview.high52Week && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">52W High</div>
                      <div className="text-xl font-black font-mono text-foreground">₪{detailData.overview.high52Week.toFixed(2)}</div>
                    </div>
                  )}
                  {detailData.overview.low52Week && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">52W Low</div>
                      <div className="text-xl font-black font-mono text-foreground">₪{detailData.overview.low52Week.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {detailData?.fund && Object.keys(detailData.fund).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-2">
                  Fund Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {detailData.fund.aum && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">AUM</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.fund.aum}</div>
                    </div>
                  )}
                  {detailData.fund.fees && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Fees</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.fund.fees}</div>
                    </div>
                  )}
                  {detailData.fund.inceptionDate && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Inception</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.fund.inceptionDate}</div>
                    </div>
                  )}
                  {detailData.fund.custodian && (
                    <div className="bg-white/[0.02] border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Custodian</div>
                      <div className="text-xl font-black font-mono text-foreground">{detailData.fund.custodian}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
