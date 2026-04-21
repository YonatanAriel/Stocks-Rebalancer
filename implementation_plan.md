# Long-Term Investment Rebalancer App - Implementation Plan

This document outlines the architecture, database schema, and development plan for your Long-Term Investment Rebalancer application.

## Overview

The application will help you manage a portfolio of stocks and ETFs (like the `1159250` S&P 500 ETF on the TASE). You will define target allocation percentages for each asset. When you have new cash to invest, the app will fetch market prices and calculate exactly how much of each asset to buy to maintain or reach your target allocations. 

## Architecture & Technology Stack (2026 Standards)

*   **Framework**: **Next.js 16** (App Router, React 19). We will leverage the latest features like Server Actions for secure database mutations, and Partial Prerendering (PPR) for fast load times.
*   **UI/Styling**: **shadcn/ui** combined with **Tailwind CSS**. We will implement a premium, dynamic dark-mode aesthetic with glassmorphism effects and modern typography (e.g., Inter or Outfit) to ensure it doesn't feel like a basic app.
*   **Database & Authentication**: **Supabase (PostgreSQL)**. 
    > [!NOTE]
    > **Cost:** Supabase has a **completely free tier** that allows up to 50,000 monthly active users and 500MB of database space. Since you are the only user, this will remain **100% free forever**. It provides out-of-the-box secure Auth and an excellent relational database.
*   **Hosting**: **Vercel** (Seamless integration with Next.js, completely free for hobby projects).
*   **Market Data API**: We will use the **Yahoo Finance API** (via `yahoo-finance2` npm package) to automatically fetch prices using the ISIN (`IE00B5BMR087`) or Yahoo ticker (`iSFF702.TA`).

## Core Design Decisions (Based on your feedback)

> [!IMPORTANT]
> **Manual Price Override (15-Minute Delay Solution)**
> Research confirms that free data sources like Yahoo Finance have a standard 15-minute delay for the Tel Aviv Stock Exchange (TASE). To solve this, the app will fetch the 15-minute delayed price automatically, but the calculator UI will allow you to **manually override the current price** of any asset. This way, right before you buy, you can look up the live price on your brokerage and enter it for a perfectly accurate calculation.

> [!TIP]
> **Dual Buying Strategy (Commission Optimization)**
> To save you money on commissions, the calculator will provide **two options** when you enter your new cash:
> 1. **Option A (Single Asset - Recommended):** The app will identify the single ETF that is furthest below its target percentage and recommend spending all the cash on that one ETF. This means you only pay commission once per month.
> 2. **Option B (Optimal Rebalance):** The app will split the cash across multiple ETFs to get your portfolio exactly to the target percentages. You can choose this option if the portfolio is heavily out of balance.

## Proposed Changes & Schema

### 1. Database Schema (Supabase / Postgres)

*   **`users`**: Managed automatically by Supabase Auth.
*   **`portfolios`**:
    *   `id` (UUID, Primary Key)
    *   `user_id` (UUID, Foreign Key to users)
    *   `name` (Text, e.g., "Main Retirement Fund")
    *   `currency` (Text, default: 'ILS') - Built to support future currencies.
*   **`assets`**:
    *   `id` (UUID, Primary Key)
    *   `portfolio_id` (UUID, Foreign Key to portfolios)
    *   `ticker` (Text, e.g., "1159250" or "iSFF702.TA")
    *   `target_percentage` (Numeric, e.g., 60.0)
    *   `shares_owned` (Numeric)

### 2. Core Application Flows

1.  **Onboarding**: User signs in (Supabase Auth).
2.  **Portfolio Configuration**: User adds their assets, enters the **number of shares currently owned**, and sets the `target_percentage` for each.
3.  **Dashboard**: Displays a beautiful donut chart of *Current Allocation* vs *Target Allocation*, and the estimated total portfolio value in ILS.
4.  **The "Buy" Calculator**:
    *   User clicks "Invest New Cash".
    *   App fetches delayed prices and shows an input grid: `[Ticker] | [Auto-Fetched Price] | [Manual Override Price Input]`.
    *   User inputs the `amount` of cash (e.g., 5,000 ILS).
    *   User can optionally tweak the prices to match their live brokerage feed.
    *   App presents the two strategies (Single ETF vs Optimal Rebalance), rounding down to whole shares and showing the leftover unspent cash.

### 3. Component Breakdown

#### `app/(auth)/login/page.tsx`
*   Secure login screen using Supabase SSR Auth.

#### `app/dashboard/page.tsx`
*   Main interface. Fetches portfolio and assets from Supabase.
*   Calls Next.js Server Actions to fetch prices via the API.

#### `components/calculator.tsx`
*   The interactive buying calculator, supporting price overrides and displaying the two buying strategies.

## Verification Plan

### Automated / API Tests
*   Verify the market data API can successfully fetch the price for `1159250` (or its equivalent ticker) in ILS.
*   Unit test the balancing algorithm (both Option A and Option B) to ensure it respects target percentages and doesn't exceed the available cash.

### Manual Verification
*   Test the full user flow: Add 3 ETFs -> Input 10,000 ILS -> Test the manual price override -> Verify the "Option A (Single ETF)" and "Option B (Multi-ETF)" math is correct.
*   Ensure the UI feels premium, with dark mode enabled and smooth micro-animations.
