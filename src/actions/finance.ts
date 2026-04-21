'use server'

import yahooFinance from 'yahoo-finance2'

export async function getAssetPrice(ticker: string): Promise<{ price: number | null, error?: string }> {
  try {
    // quoteCombine is the v3 replacement for the deprecated quote()
    const quote = await yahooFinance.quoteCombine(ticker)
    
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
