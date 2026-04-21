// Shared types used across dashboard components
export interface Asset {
  id: string;
  portfolio_id: string;
  ticker: string;
  target_percentage: number;
  shares_owned: number;
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
}

export interface PriceMap {
  [ticker: string]: number | null;
}
