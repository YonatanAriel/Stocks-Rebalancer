'use server'

import YahooFinance from 'yahoo-finance2'

// yahoo-finance2 v3 requires instantiation
const yf = new YahooFinance()

export async function getAssetPrice(ticker: string): Promise<{ price: number | null; error?: string }> {
  try {
    // Attempt 1: Direct quote
    let quote;
    try {
      quote = await yf.quote(ticker)
    } catch {
      quote = null;
    }

    if (quote && quote.regularMarketPrice) {
      return { price: quote.regularMarketPrice }
    }

    // Attempt 2: If direct quote failed, maybe it's missing a suffix (like .TA for Israeli mutual funds)
    // We can use the search API to find the best match
    const searchResult = await yf.search(ticker)
    if (searchResult.quotes && searchResult.quotes.length > 0) {
      const bestMatchSymbol = searchResult.quotes[0].symbol as string
      
      if (bestMatchSymbol) {
        const fallbackQuote = await yf.quote(bestMatchSymbol)
        
        if (fallbackQuote && fallbackQuote.regularMarketPrice) {
          return { price: fallbackQuote.regularMarketPrice }
        }
      }
    }

    return { price: null, error: 'Price not found for the given ticker' }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching Yahoo Finance data:', message)
    return { price: null, error: message }
  }
}
