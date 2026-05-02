"use client";

import { useEffect, useState } from "react";
import type { AssetWithValue, StockDetail } from "@/lib/types";
import { X, TrendingUp, TrendingDown } from "lucide-react";

interface StockDetailModalProps {
  asset: AssetWithValue | null;
  isOpen: boolean;
  onClose: () => void;
  totalValue: number;
  assetName?: string;
}

function PerformanceBar({ label, value, isPositive }: { label: string; value: string; isPositive?: boolean }) {
  const numValue = parseFloat(value);
  const isNum = !isNaN(numValue);
  const barWidth = isNum ? Math.min(Math.abs(numValue), 100) : 0;
  
  const hasHebrew = /[\u0590-\u05FF]/.test(label);
  
  return (
    <div className="space-y-2">
      <div className={`flex justify-between items-center gap-4 ${hasHebrew ? 'flex-row-reverse' : ''}`}>
        <span className={`text-[10px] uppercase tracking-widest font-black text-muted-foreground whitespace-nowrap ${hasHebrew ? 'text-right' : ''}`}>{label}</span>
        <span className={`text-sm font-black font-mono whitespace-nowrap ${isPositive === true ? 'text-primary' : isPositive === false ? 'text-destructive' : 'text-foreground'}`}>
          {value}
        </span>
      </div>
      {isNum && (
        <div className="h-1 bg-white/5 border border-border overflow-hidden">
          <div 
            className={`h-full transition-all ${numValue >= 0 ? 'bg-primary' : 'bg-destructive'}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  );
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
          setLoading(false);
        });
    }
  }, [isOpen, asset]);
  
  if (!isOpen || !asset) return null;
  
  const currentPct = totalValue > 0 ? ((asset.currentValue || 0) / totalValue) * 100 : 0;
  const deviation = currentPct - asset.target_percentage;
  const changePercent = detailData?.changePercent ?? 0;
  const isPositiveChange = changePercent >= 0;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="max-w-3xl w-full bg-background border-2 border-primary rounded-none overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b-2 border-primary/30 relative bg-gradient-to-r from-primary/10 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center border border-primary/50 hover:border-primary hover:bg-primary/20 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="space-y-4">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-[0.3em] text-primary font-heading">
                {asset.ticker}
              </h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-black mt-1">
                {assetName || detailData?.name || "Loading..."}
              </p>
            </div>
            
            {!loading && detailData && (
              <div className="space-y-3 pt-2">
                <div className="flex items-baseline gap-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Current Price</div>
                    <div className="text-5xl font-black font-mono text-foreground">
                      ₪{detailData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  {changePercent !== 0 && (
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${isPositiveChange ? 'text-primary' : 'text-destructive'}`}>
                        {isPositiveChange ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        <span className="text-2xl font-black font-mono">
                          {isPositiveChange ? '+' : ''}{changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
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
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-3">
                Your Position
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Shares Owned
                  </div>
                  <div className="text-3xl font-black font-mono text-foreground">
                    {asset.shares_owned}
                  </div>
                </div>
                
                <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Current Value
                  </div>
                  <div className="text-3xl font-black font-mono text-foreground">
                    ₪{(asset.currentValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                
                <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Target Allocation
                  </div>
                  <div className="text-3xl font-black font-mono text-foreground">
                    {asset.target_percentage}%
                  </div>
                </div>
                
                <div className={`bg-white/[0.02] border p-4 hover:border-opacity-40 transition-colors ${Math.abs(deviation) > 2 ? 'border-orange-400/30' : 'border-border'}`}>
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Current Allocation
                  </div>
                  <div className={`text-3xl font-black font-mono ${Math.abs(deviation) > 2 ? 'text-orange-400' : 'text-primary'}`}>
                    {currentPct.toFixed(2)}%
                  </div>
                </div>
              </div>
              
              {Math.abs(deviation) > 0.1 && (
                <div className={`p-3 border-l-4 text-[11px] font-black uppercase tracking-widest ${Math.abs(deviation) > 2 ? 'border-orange-400 bg-orange-400/5 text-orange-300' : 'border-primary bg-primary/5 text-primary'}`}>
                  {Math.abs(deviation) > 2 ? '⚠️ ' : ''}Deviation: {deviation > 0 ? '+' : ''}{deviation.toFixed(2)}%
                </div>
              )}
            </div>
            
            {detailData?.performance && Object.values(detailData.performance).some(v => v !== undefined && v !== null) && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-3">
                  Performance
                </h3>
                <div className="space-y-4">
                  {detailData.performance.oneMonth && (
                    <PerformanceBar 
                      label="1 Month" 
                      value={detailData.performance.oneMonth}
                      isPositive={parseFloat(detailData.performance.oneMonth) >= 0}
                    />
                  )}
                  {detailData.performance.threeMonth && (
                    <PerformanceBar 
                      label="3 Months" 
                      value={detailData.performance.threeMonth}
                      isPositive={parseFloat(detailData.performance.threeMonth) >= 0}
                    />
                  )}
                  {detailData.performance.ytd && (
                    <PerformanceBar 
                      label="YTD (Year to Date)" 
                      value={detailData.performance.ytd}
                      isPositive={parseFloat(detailData.performance.ytd) >= 0}
                    />
                  )}
                  {detailData.performance.oneYear && (
                    <PerformanceBar 
                      label="1 Year" 
                      value={detailData.performance.oneYear}
                      isPositive={parseFloat(detailData.performance.oneYear) >= 0}
                    />
                  )}
                </div>
                
                {(detailData.performance.standardDeviation || detailData.performance.sharpeRatio) && (
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                    {detailData.performance.standardDeviation && detailData.performance.standardDeviation !== '--' && (
                      <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                        <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                          Std Deviation (Volatility)
                        </div>
                        <div className="text-lg font-black font-mono text-foreground">{detailData.performance.standardDeviation}</div>
                      </div>
                    )}
                    {detailData.performance.sharpeRatio && detailData.performance.sharpeRatio !== '--' && (
                      <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                        <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">Sharpe Ratio</div>
                        <div className="text-lg font-black font-mono text-foreground">{detailData.performance.sharpeRatio}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {detailData?.overview && Object.keys(detailData.overview).filter(k => {
              const key = k as keyof typeof detailData.overview;
              return detailData.overview?.[key] !== undefined;
            }).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-3">
                  Overview
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {detailData.overview.marketCap && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">Market Cap</div>
                      <div className="text-lg font-black font-mono text-foreground">{detailData.overview.marketCap}</div>
                    </div>
                  )}
                  {detailData.overview.volume && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">Volume</div>
                      <div className="text-lg font-black font-mono text-foreground">{detailData.overview.volume}</div>
                    </div>
                  )}
                  {detailData.overview.high52Week && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">52W High</div>
                      <div className="text-lg font-black font-mono text-primary">₪{detailData.overview.high52Week.toFixed(2)}</div>
                    </div>
                  )}
                  {detailData.overview.low52Week && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">52W Low</div>
                      <div className="text-lg font-black font-mono text-destructive">₪{detailData.overview.low52Week.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {detailData?.fund && Object.keys(detailData.fund).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/30 pb-3">
                  Fund Information
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {detailData.fund.aum && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">AUM</div>
                      <div className="text-lg font-black font-mono text-foreground">{detailData.fund.aum}</div>
                    </div>
                  )}
                  {detailData.fund.fees && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">Fees</div>
                      <div className="text-lg font-black font-mono text-foreground">{detailData.fund.fees}</div>
                    </div>
                  )}
                  {detailData.fund.inceptionDate && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">Inception</div>
                      <div className="text-lg font-black font-mono text-foreground">{detailData.fund.inceptionDate}</div>
                    </div>
                  )}
                  {detailData.fund.custodian && (
                    <div className="bg-white/[0.02] border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">Custodian</div>
                      <div className="text-lg font-black font-mono text-foreground">{detailData.fund.custodian}</div>
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
