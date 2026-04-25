# Plan 4: Fix Mobile and Tablet Scrolling

## Problem Statement

Scrolling doesn't work properly on tablet and mobile devices.

## Root Cause Analysis

### Likely Issues

1. **Fixed height containers** without overflow
2. **Viewport height (vh) units** causing issues on mobile
3. **Touch event conflicts** with pointer-events
4. **Nested scroll containers** fighting each other
5. **Missing `-webkit-overflow-scrolling: touch`** for iOS

## Investigation Steps

### 1. Check Current Layout Structure

**File:** `src/components/dashboard-shell.tsx`

Current structure:
```typescript
<div className="h-screen flex flex-col">
  <DashboardHeader />
  <main className="flex-1 flex flex-col min-h-0">
    <div className="flex-1 min-h-0 grid gap-8 grid-cols-1 lg:grid-cols-[1fr_350px]">
      <AssetsList />  // Needs internal scroll
      <AllocationChart />  // Fixed height
    </div>
  </main>
</div>
```

### 2. Identify Scroll Containers

**Assets List:**
- Should scroll internally
- Currently: `overflow-y-auto custom-scrollbar`
- Issue: May not work on mobile

**Allocation Chart:**
- Should be fixed/sticky
- No scrolling needed

## Solution Plan

### Fix 1: Add Touch Scrolling Support

**File:** `src/app/globals.css`

Add iOS-specific scrolling:
```css
.custom-scrollbar {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

### Fix 2: Fix Viewport Height on Mobile

Replace `h-screen` with proper mobile-friendly approach:

```typescript
// Before
<div className="h-screen flex flex-col">

// After
<div className="h-[100dvh] flex flex-col">
// or
<div className="min-h-screen flex flex-col">
```

**Note:** `100dvh` (dynamic viewport height) accounts for mobile browser UI

### Fix 3: Ensure Proper Overflow

**File:** `src/components/dashboard/assets-list.tsx`

```typescript
<CardContent className="flex-1 overflow-y-auto custom-scrollbar p-0">
  {/* content */}
</CardContent>
```

Add explicit touch-action:
```typescript
<CardContent className="flex-1 overflow-y-auto custom-scrollbar p-0 touch-pan-y">
```

### Fix 4: Remove Conflicting pointer-events

Check for `pointer-events: auto` that might block touch:

```typescript
// Review all instances of:
style={{ pointerEvents: 'auto' }}

// Ensure they don't block scrolling
```

### Fix 5: Test Scroll Containers

Add data attributes for debugging:
```typescript
<div 
  className="overflow-y-auto"
  data-scroll-container="assets-list"
  style={{ 
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain'
  }}
>
```

## Implementation Steps

### Step 1: Update Global Styles

**File:** `src/app/globals.css`

```css
/* Enhanced scrolling for mobile */
.custom-scrollbar {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

/* Ensure touch events work */
.touch-pan-y {
  touch-action: pan-y;
}

.touch-pan-x {
  touch-action: pan-x;
}
```

### Step 2: Fix Dashboard Shell

**File:** `src/components/dashboard-shell.tsx`

```typescript
// Change from h-screen to h-[100dvh]
<div className="h-[100dvh] flex flex-col bg-dot-pattern mesh-glow overflow-hidden">
  <DashboardHeader />
  
  <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
    <div className="flex-1 min-h-0 grid gap-8 grid-cols-1 lg:grid-cols-[1fr_350px] px-6 py-6 overflow-hidden">
      {/* Assets list with internal scroll */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <AssetsList />
      </div>
      
      {/* Allocation chart - no scroll needed */}
      <div className="flex-shrink-0">
        <AllocationChart />
      </div>
    </div>
  </main>
</div>
```

### Step 3: Fix Assets List Scrolling

**File:** `src/components/dashboard/assets-list.tsx`

```typescript
<Card className="h-full flex flex-col min-h-0">
  <CardHeader className="flex-shrink-0">
    {/* Header content */}
  </CardHeader>
  
  <div className="flex-shrink-0">
    {/* Column headers */}
  </div>
  
  <CardContent 
    className="flex-1 overflow-y-auto custom-scrollbar touch-pan-y p-0"
    style={{
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain'
    }}
  >
    {/* Asset rows */}
  </CardContent>
</Card>
```

### Step 4: Test on Multiple Devices

**Devices to test:**
- iPhone (Safari)
- Android (Chrome)
- iPad (Safari)
- Android tablet (Chrome)
- Desktop (Chrome, Firefox, Safari)

**Test scenarios:**
1. Scroll assets list
2. Scroll rebalance modal
3. Scroll with many assets (20+)
4. Pinch to zoom (should be disabled)
5. Pull to refresh (should be disabled)

## Additional Mobile Optimizations

### Disable Unwanted Touch Behaviors

```css
/* Prevent pull-to-refresh */
body {
  overscroll-behavior-y: none;
}

/* Prevent pinch-to-zoom */
html {
  touch-action: manipulation;
}
```

### Add Viewport Meta Tag

**File:** `src/app/layout.tsx`

Ensure proper viewport settings:
```typescript
export const metadata = {
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}
```

## Files to Modify

1. ✅ `src/app/globals.css` - Add touch scrolling styles
2. ✅ `src/components/dashboard-shell.tsx` - Fix viewport height
3. ✅ `src/components/dashboard/assets-list.tsx` - Add touch-pan-y
4. ✅ `src/app/layout.tsx` - Update viewport meta

## Success Criteria

- ✅ Smooth scrolling on iOS Safari
- ✅ Smooth scrolling on Android Chrome
- ✅ No scroll conflicts between containers
- ✅ Pull-to-refresh disabled
- ✅ Pinch-to-zoom disabled (for app-like feel)
- ✅ Works in landscape and portrait

## Implementation Time

**Estimated:** 1-2 hours
- 30 min: CSS updates
- 30 min: Component updates
- 30 min: Testing on devices
- 30 min: Bug fixes
