# Plan 3: Stock Detail Modal

## Problem Statement

When user clicks on a stock row in the table, show a detailed modal with comprehensive information about the security.

## Data Sources Research

### 1. Bizportal (Israeli Securities)
**Available Data:**
- Security ID and name
- Unit value (current price)
- As-of date (last update)
- Change percentage
- Turnover
- Returns: 1 month, 3 months, 12 months, YTD
- Standard deviation (volatility)
- Sharpe ratio
- Asset composition (holdings breakdown)
- Fund size (AUM)
- Management fees
- Bank/custodian information
- Inception date

**Example Response:**
```json
{
  "securityId": "5137740",
  "name": "קסם אקטיב כספית שקלית",
  "unitValueText": "₪ 2,282.50",
  "asOf": "- 03/26",
  "changeText": "מדיניות אחרון",
  "monthReturnText": "0.22%",
  "yearReturnText": "1.17%",
  "threeMonthReturnText": "0.94%",
  "twelveMonthReturnText": "4.25%"
}
```

### 2. Yahoo Finance (International Stocks)
**Available Data:**
- Current price
- Day range (high/low)
- 52-week range
- Volume
- Average volume
- Market cap
- Beta
- PE ratio
- EPS
- Dividend yield
- Ex-dividend date
- 1-year target estimate

### 3. Google Finance (Fallback)
**Available Data:**
- Current price
- Currency
- Company name
- Exchange
- Basic price data

## Modal Design

### Layout Structure

```
┌─────────────────────────────────────────────┐
│  [X]                                        │
│  IBIT                                       │
│  iShares Bitcoin Trust                      │
│  ₪131.46                                    │
│  +2.34 (+1.81%)                            │
├─────────────────────────────────────────────┤
│  OVERVIEW                                   │
│  ┌─────────────┬─────────────┐            │
│  │ Market Cap  │ Volume      │            │
│  │ $50.2B      │ 1.2M        │            │
│  ├─────────────┼─────────────┤            │
│  │ 52W High    │ 52W Low     │            │
│  │ ₪145.20     │ ₪98.50      │            │
│  └─────────────┴─────────────┘            │
├─────────────────────────────────────────────┤
│  PERFORMANCE                                │
│  ┌─────────────────────────────────────┐  │
│  │ 1 Month    │ +5.2%                  │  │
│  │ 3 Months   │ +12.8%                 │  │
│  │ YTD        │ +18.3%                 │  │
│  │ 1 Year     │ +45.6%                 │  │
│  └─────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  YOUR POSITION                              │
│  ┌─────────────────────────────────────┐  │
│  │ Shares Owned    │ 7                 │  │
│  │ Avg Cost        │ ₪120.00           │  │
│  │ Current Value   │ ₪920.46           │  │
│  │ Gain/Loss       │ +₪80.46 (+9.6%)   │  │
│  │ Target %        │ 0%                │  │
│  │ Current %       │ 0.30%             │  │
│  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Data Sections

#### 1. Header
- Ticker symbol (large, bold)
- Full name
- Current price (large)
- Change (with color: green/red)
- Last updated timestamp

#### 2. Overview (Grid Layout)
- Market Cap
- Volume / Avg Volume
- 52-Week High / Low
- Beta (volatility)
- PE Ratio
- Dividend Yield (if applicable)

#### 3. Performance (Israeli Securities)
- 1 Month Return
- 3 Month Return
- YTD Return
- 1 Year Return
- Standard Deviation
- Sharpe Ratio

#### 4. Your Position
- Shares Owned
- Average Cost (if tracked)
- Current Value
- Gain/Loss (absolute + percentage)
- Target Allocation %
- Current Allocation %
- Deviation from target

#### 5. Additional Info (Israeli Securities)
- Fund Size (AUM)
- Management Fees
- Inception Date
- Custodian Bank
- Asset Composition (if available)

## Implementation Plan

### Step 1: Create Detail Modal Component

**File:** `src/components/stock-detail-modal.tsx`

```typescript
interface StockDetailModalProps {
  asset: AssetWithValue;
  isOpen: boolean;
  onClose: () => void;
  totalValue: number;
}

export function StockDetailModal({ asset, isOpen, onClose, totalValue }: StockDetailModalProps) {
  const [detailData, setDetailData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isOpen) {
      fetchStockDetails(asset.ticker);
    }
  }, [isOpen, asset.ticker]);
  
  // Render modal with sections
}
```

### Step 2: Enhance Data Fetching

**File:** `src/actions/finance.ts`

Add new function:
```typescript
export async function getStockDetails(ticker: string): Promise<StockDetail> {
  // Check if Israeli security
  if (/^\d{6,8}$/.test(ticker)) {
    return await getBizportalDetails(ticker);
  }
  
  // International stock
  return await getYahooFinanceDetails(ticker);
}
```

**File:** `src/lib/scrapeBizportalEtf.ts`

Enhance scraper to extract additional fields:
```typescript
export async function scrapeBizportalDetails(securityId: string) {
  // Extract all available data
  return {
    price: ...,
    name: ...,
    returns: {
      oneMonth: ...,
      threeMonth: ...,
      ytd: ...,
      oneYear: ...
    },
    risk: {
      standardDeviation: ...,
      sharpeRatio: ...
    },
    fund: {
      aum: ...,
      fees: ...,
      inceptionDate: ...,
      custodian: ...
    }
  };
}
```

### Step 3: Add Click Handler to Table Row

**File:** `src/components/dashboard/assets-list.tsx`

Update `AssetRow` component:
```typescript
function AssetRow({ asset, ... }) {
  return (
    <div 
      className="grid grid-cols-[...] cursor-pointer"
      onClick={() => onRowClick(asset)}
    >
      {/* existing content */}
    </div>
  );
}
```

Add state for modal:
```typescript
const [selectedAsset, setSelectedAsset] = useState<AssetWithValue | null>(null);

<StockDetailModal
  asset={selectedAsset}
  isOpen={!!selectedAsset}
  onClose={() => setSelectedAsset(null)}
  totalValue={totalValue}
/>
```

### Step 4: Create Type Definitions

**File:** `src/lib/types.ts`

```typescript
export interface StockDetail {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  
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
```

### Step 5: Style Modal

Use brutalist design matching the app:
- Sharp corners (no border-radius)
- High contrast
- Mint green accents
- Black background
- Grid layout for data
- Monospace font for numbers

## API Endpoints to Create

### 1. Stock Details Endpoint

**File:** `src/app/api/stock-details/[ticker]/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const details = await getStockDetails(params.ticker);
  return Response.json(details);
}
```

## Testing Plan

### Data Validation
1. Test with Israeli ETF (e.g., 1159250)
2. Test with Israeli mutual fund (e.g., 5137740)
3. Test with US stock (e.g., IBIT)
4. Test with stock that has no data
5. Test with invalid ticker

### UI Testing
1. Click on each asset type
2. Verify modal opens smoothly
3. Verify data displays correctly
4. Verify close button works
5. Verify clicking outside closes modal
6. Test on mobile (responsive)

### Performance
1. Measure modal open time
2. Ensure data fetches < 3 seconds
3. Show loading state while fetching
4. Cache data for repeated opens

## Files to Create/Modify

### New Files
1. ✅ `src/components/stock-detail-modal.tsx` - Modal component
2. ✅ `src/app/api/stock-details/[ticker]/route.ts` - API endpoint

### Modified Files
1. ✅ `src/components/dashboard/assets-list.tsx` - Add click handler
2. ✅ `src/actions/finance.ts` - Add getStockDetails()
3. ✅ `src/lib/scrapeBizportalEtf.ts` - Enhance scraper
4. ✅ `src/lib/types.ts` - Add StockDetail interface

## Success Criteria

- ✅ Modal opens on row click
- ✅ Displays comprehensive data for all asset types
- ✅ Loads in < 3 seconds
- ✅ Responsive on mobile
- ✅ Matches brutalist design aesthetic
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Smooth animations

## Implementation Time

**Estimated:** 4-6 hours
- 2 hours: Enhanced scraping logic
- 2 hours: Modal component and layout
- 1 hour: API endpoint
- 1 hour: Testing and refinement
