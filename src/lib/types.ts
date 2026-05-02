export interface Asset {
  id: string;
  portfolio_id: string;
  ticker: string;
  name?: string;
  target_percentage: number;
  shares_owned: number;
  manual_price_override?: number | null;
  manual_price_set_at?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export interface Portfolio {
  id: string;
  name: string;
  currency: string;
  commission_percentage: number;
  commission_minimum: number;
  assets: Asset[];
}

export interface AssetWithValue extends Asset {
  price: number | null;
  currentValue: number | null;
  priceSource?: 'manual' | 'scraped';
}

export interface PriceMap {
  [ticker: string]: number | null;
}

export interface StockDetail {
  ticker: string;
  name: string;
  price: number;
  change?: number;
  changePercent?: number;
  lastUpdated?: string;
  
  overview?: {
    marketCap?: string;
    volume?: string;
    avgVolume?: string;
    high52Week?: number;
    low52Week?: number;
    beta?: number;
    peRatio?: number;
    dividendYield?: number;
  };
  
  performance?: {
    oneMonth?: string;
    threeMonth?: string;
    ytd?: string;
    oneYear?: string;
    standardDeviation?: string;
    sharpeRatio?: string;
  };
  
  fund?: {
    aum?: string;
    fees?: string;
    inceptionDate?: string;
    custodian?: string;
  };
}
