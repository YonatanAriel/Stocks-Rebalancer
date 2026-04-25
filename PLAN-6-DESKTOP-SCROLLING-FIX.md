# Plan 6: Fix Desktop Scrolling with Multiple Assets

## Problem Statement

When there are multiple stocks, users can't reach assets at the bottom. The portfolio section and target allocation section reach the bottom of the screen without internal scrolling.

## Current Issue (Based on Screenshot)

### Layout Problem
```
┌─────────────────────────────────────┐
│ Header (fixed)                      │
├─────────────────────────────────────┤
│ ┌─────────────┬─────────────────┐  │
│ │ MY PORTFOLIO│ TARGET          │  │
│ │             │ ALLOCATION      │  │
│ │ Asset 1     │                 │  │
│ │ Asset 2     │   [Chart]       │  │
│ │ Asset 3     │                 │  │
│ │ Asset 4     │                 │  │
│ │ Asset 5     │                 │  │
│ │ Asset 6 ← Can't see!           │  │
│ │ Asset 7 ← Can't see!           │  │
└─┴─────────────┴─────────────────┴──┘
  ↑ Content extends beyond viewport
```

### Root Cause
- Main container uses `h-screen` but doesn't account for header
- No internal scrolling on assets list
- Grid layout doesn't constrain height properly

## Solution Strategy

### Desktop Layout Requirements
1. Header stays fixed at top
2. Main content area fills remaining viewport height
3. Assets list has internal scrolling
4. Target allocation stays visible (fixed or scrolls with content)
5. Never extends beyond viewport bottom

## Implementation Plan

### Step 1: Fix Main Layout Container

**File:** `src/components/dashboard-shell.tsx`

**Current:**
```typescript
<div className="h-screen flex flex-col">
  <DashboardHeader />
  <main className="flex-1 flex flex-col min-h-0">
    <div className="flex-1 min-h-0 grid gap-8 grid-cols-1 lg:grid-cols-[1fr_350px]">
```

**Change to:**
```typescript
<div className="h-screen flex flex-col overflow-hidden">
  <DashboardHeader userEmail={userEmail} />
  
  <main className="flex-1 min-h-0 overflow-hidden">
    <div className="h-full grid gap-8 grid-cols-1 lg:grid-cols-[1fr_350px] px-6 py-6 overflow-hidden">
      {/* Left column: Assets list with scroll */}
      <div className="min-h-0 overflow-hidden">
        <AssetsList />
      </div>
      
      {/* Right column: Allocation chart (fixed height) */}
      <div className="min-h-0 overflow-y-auto">
        <Card className="sticky top-0">
          <AllocationChart />
        </Card>
      </div>
    </div>
  </main>
</div>
```

### Step 2: Fix Assets List Card

**File:** `src/components/dashboard/assets-list.tsx`

**Current:**
```typescript
<Card className="h-full flex flex-col min-h-0">
  <CardHeader>...</CardHeader>
  <div>Column headers</div>
  <CardContent className="flex-1 overflow-y-auto">
```

**Change to:**
```typescript
<Card className="h-full flex flex-col overflow-hidden">
  {/* Header - fixed */}
  <CardHeader className="flex-shrink-0">
    {/* Portfolio name and buttons */}
  </CardHeader>
  
  {/* Column headers - fixed */}
  <div className="flex-shrink-0 grid grid-cols-[...] border-b">
    {/* Column headers */}
  </div>
  
  {/* Scrollable content */}
  <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-0">
    <div className="divide-y divide-white/[0.05]">
      {sortedAssets.map((asset) => (
        <AssetRow key={asset.id} asset={asset} />
      ))}
    </div>
  </CardContent>
</Card>
```

### Step 3: Ensure Proper Height Constraints

**Key CSS Classes:**
```css
/* Parent container */
.h-screen          /* 100vh */
.flex              /* Flexbox */
.flex-col          /* Column direction */
.overflow-hidden   /* Prevent overflow */

/* Main content */
.flex-1            /* Grow to fill space */
.min-h-0           /* Allow shrinking below content size */
.overflow-hidden   /* Prevent overflow */

/* Scrollable area */
.overflow-y-auto   /* Enable vertical scroll */
.custom-scrollbar  /* Custom scrollbar styles */
```

### Step 4: Add Scroll Indicators

**File:** `src/components/dashboard/assets-list.tsx`

Add visual indicator when content is scrollable:

```typescript
const [showScrollIndicator, setShowScrollIndicator] = useState(false);
const scrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  
  const checkScroll = () => {
    const hasScroll = el.scrollHeight > el.clientHeight;
    setShowScrollIndicator(hasScroll && el.scrollTop < el.scrollHeight - el.clientHeight - 10);
  };
  
  checkScroll();
  el.addEventListener('scroll', checkScroll);
  window.addEventListener('resize', checkScroll);
  
  return () => {
    el.removeEventListener('scroll', checkScroll);
    window.removeEventListener('resize', checkScroll);
  };
}, [sortedAssets]);

// Render indicator
{showScrollIndicator && (
  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none flex items-end justify-center pb-2">
    <div className="text-xs text-muted-foreground animate-bounce">
      ↓ Scroll for more
    </div>
  </div>
)}
```

### Step 5: Handle Rebalance Modal Scrolling

**File:** `src/components/dashboard-shell.tsx`

Ensure modal also has proper scrolling:

```typescript
{showCalculator && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="max-w-5xl max-h-[90vh] overflow-y-auto">
      <RebalanceCalculator />
    </div>
  </div>
)}
```

## Layout Hierarchy

```
┌─────────────────────────────────────────┐
│ Dashboard Shell (h-screen, flex-col)    │
│ ┌─────────────────────────────────────┐ │
│ │ Header (flex-shrink-0)              │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Main (flex-1, min-h-0)              │ │
│ │ ┌─────────────┬─────────────────┐   │ │
│ │ │ Assets List │ Allocation      │   │ │
│ │ │ (overflow)  │ (sticky)        │   │ │
│ │ │ ┌─────────┐ │ ┌─────────────┐ │   │ │
│ │ │ │ Header  │ │ │   Chart     │ │   │ │
│ │ │ ├─────────┤ │ │             │ │   │ │
│ │ │ │ Columns │ │ │             │ │   │ │
│ │ │ ├─────────┤ │ └─────────────┘ │   │ │
│ │ │ │ ↓ Scroll│ │                 │   │ │
│ │ │ │ Asset 1 │ │                 │   │ │
│ │ │ │ Asset 2 │ │                 │   │ │
│ │ │ │ Asset 3 │ │                 │   │ │
│ │ │ │ ...     │ │                 │   │ │
│ │ │ └─────────┘ │                 │   │ │
│ │ └─────────────┴─────────────────┘   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Testing Plan

### Desktop Testing
1. Add 20+ assets to portfolio
2. Verify assets list scrolls internally
3. Verify header stays fixed
4. Verify allocation chart stays visible
5. Test window resize behavior

### Responsive Testing
1. Test at various desktop widths (1920px, 1440px, 1280px)
2. Verify layout doesn't break
3. Test with different zoom levels (80%, 100%, 125%)

### Edge Cases
1. Very long asset names
2. Many assets (50+)
3. Small viewport height (900px)
4. Large viewport height (1440px)

## Files to Modify

1. ✅ `src/components/dashboard-shell.tsx` - Main layout
2. ✅ `src/components/dashboard/assets-list.tsx` - Scrollable card
3. ✅ `src/app/globals.css` - Scrollbar styles (if needed)

## Success Criteria

- ✅ All assets visible via scrolling
- ✅ Header stays fixed at top
- ✅ No content extends beyond viewport
- ✅ Smooth scrolling experience
- ✅ Scroll indicator shows when needed
- ✅ Works on all desktop sizes
- ✅ Allocation chart remains accessible

## Implementation Time

**Estimated:** 2-3 hours
- 1 hour: Layout restructuring
- 1 hour: Testing with many assets
- 30 min: Scroll indicator
- 30 min: Edge case handling
