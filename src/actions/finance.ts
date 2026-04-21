'use server'

import yahooFinance from 'yahoo-finance2'

export async function getAssetPrice(ticker: string): Promise<{ price: number | null, error?: string }> {
  try {
    // Disable logging for cleaner console during requests
    yahooFinance.suppressNotices(['yahooSurvey'])
    
    const quote = await yahooFinance.quote(ticker)
    
    // Most standard quotes return regularMarketPrice.
    if (quote && quote.regularMarketPrice) {
      return { price: quote.regularMarketPrice }
    }
    
    return { price: null, error: 'Price not found for the given ticker' }
  } catch (error: any) {
    console.error('Error fetching Yahoo Finance data:', error)
    return { price: null, error: error.message }
  }
}
