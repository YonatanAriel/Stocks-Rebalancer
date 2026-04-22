export interface Asset {
  id: string;
  portfolio_id: string;
  ticker: string;
  name?: string;
  target_percentage: number;
  shares_owned: number;
  manual_value?: number | null;
  manual_price_override?: number | null;
  manual_price_set_at?: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  currency: string;
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
