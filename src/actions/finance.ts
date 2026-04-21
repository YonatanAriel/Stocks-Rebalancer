'use server'

import YahooFinance from 'yahoo-finance2'

// yahoo-finance2 v3 requires instantiation
const yf = new YahooFinance()

export async function getAssetPrice(ticker: string): Promise<{ price: number | null; error?: string }> {
  try {
    const quote = await yf.quoteCombine(ticker)

    if (quote && quote.regularMarketPrice) {
      return { price: quote.regularMarketPrice }
    }

    return { price: null, error: 'Price not found for the given ticker' }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching Yahoo Finance data:', message)
    return { price: null, error: message }
  }
}
