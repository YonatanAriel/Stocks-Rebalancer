'use server'

import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/utils/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'


const yf = new YahooFinance()

// Request timeout constant (8 seconds to stay under Vercel's 10s limit)
const REQUEST_TIMEOUT = 8000;

// Helper function to create a timeout promise
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), ms)
  );
}

// Helper function to chunk array for parallel processing
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getUsdIlsRate(): Promise<number> {
  try {
    const quote = await yf.quote('ILS=X');
    const price = quote.regularMarketPrice || 3.7;
    console.log(`[Finance] Current USD/ILS rate: ${price}`);
    return price;
  } catch (error) {
    console.error('[Finance] Error fetching exchange rate:', error);
    return 3.7;
  }
}

export async function setManualPrice(securityId: string, price: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('assets')
      .update({
        manual_price_override: price,
        manual_price_set_at: new Date().toISOString(),
      })
      .eq('ticker', securityId);
    
    if (error) {
      console.error(`[Finance] Error setting manual price:`, error);
      return { ok: false, error: error.message };
    }
    
    console.log(`[Finance] Manual price set for ${securityId}: ₪${price}`);
    return { ok: true };
  } catch (error: any) {
    console.error('[Finance] Error:', error.message);
    return { ok: false, error: error.message };
  }
}

export async function clearManualPrice(securityId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('assets')
      .update({
        manual_price_override: null,
        manual_price_set_at: null,
      })
      .eq('ticker', securityId);
    
    if (error) {
      console.error(`[Finance] Error clearing manual price:`, error);
      return { ok: false, error: error.message };
    }
    
    console.log(`[Finance] Manual price cleared for ${securityId}`);
    return { ok: true };
  } catch (error: any) {
    console.error('[Finance] Error:', error.message);
    return { ok: false, error: error.message };
  }
}

async function getPriceFromBizportal(ticker: string): Promise<{ price: number | null; name: string | null }> {
  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/etf/${ticker}`;
    console.log(`[Finance] Bizportal URL: ${url}`);
    
    // Fetch without timeout here - timeout is handled at API route level
    const response = await fetch(url, { cache: 'no-store' });
    
    console.log(`[Finance] Response status: ${response.status}`);
    console.log(`[Finance] Response headers:`, {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });
    
    if (!response.ok) {
      console.error(`[Finance] Bizportal API returned ${response.status}`);
      const text = await response.text();
      console.error(`[Finance] Response body (first 500 chars):`, text.substring(0, 500));
      return { price: null, name: null };
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error(`[Finance] Response is not JSON, content-type: ${contentType}`);
      const text = await response.text();
      console.error(`[Finance] Response body (first 500 chars):`, text.substring(0, 500));
      return { price: null, name: null };
    }
    
    const json = await response.json();
    console.log(`[Finance] Bizportal response:`, JSON.stringify(json, null, 2));
    
    const { ok, data } = json;
    if (!ok || !data) {
      console.error('[Finance] Bizportal API returned invalid response structure');
      return { price: null, name: null };
    }
    
    console.log(`[Finance] Bizportal data keys:`, Object.keys(data));
    console.log(`[Finance] unitValueText raw: "${data.unitValueText}"`);
    
    // Extract price from unitValueText (e.g., "₪ 2,282.50")
    let price: number | null = null;
    if (data.unitValueText) {
      console.log(`[Finance] Attempting to extract price from: "${data.unitValueText}"`);
      const match = data.unitValueText.match(/([\d,]+\.?\d*)/);
      console.log(`[Finance] Regex match result:`, match);
      
      if (match) {
        const priceStr = match[1].replace(/,/g, '');
        price = parseFloat(priceStr);
        console.log(`[Finance] Parsed price: ${price}`);
      } else {
        console.log(`[Finance] No regex match found in unitValueText`);
      }
    } else {
      console.log(`[Finance] unitValueText is null or undefined`);
    }
    
    if (price) {
      // Israeli securities are quoted in agorot, convert to shekels
      price = price / 100;
      console.log(`[Finance] Got Bizportal price for ${ticker}: ₪${price} (converted from agorot)`);
      return { price, name: data.name };
    }
    
    console.log(`[Finance] Price extraction failed for ${ticker}`);
    return { price: null, name: null };
  } catch (error) {
    console.error('[Finance] Bizportal error:', error);
    return { price: null, name: null };
  }
}

async function getPriceFromGoogleFinance(ticker: string): Promise<{ price: number | null; currency: string | null; name: string | null }> {
  try {
    const exchanges = [/^\d+$/.test(ticker) ? 'TLV' : 'NASDAQ', 'NYSE', 'TLV'];
    let text = '';
    let foundExchange = '';

    for (const ex of exchanges) {
      const url = `https://www.google.com/finance/quote/${ticker}:${ex}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 60 }
      });
      if (response.ok) {
        text = await response.text();
        if (text.includes(ticker)) {
          foundExchange = ex;
          break;
        }
      }
    }

    if (!text) return { price: null, currency: null, name: null };

    // Extract name
    const nameMatch = text.match(/<div class="zz3gNc">([^<]+)<\/div>/) || text.match(/<div class="yf_ticker_name">([^<]+)<\/div>/);
    const name = nameMatch ? nameMatch[1] : null;

    // 1. Try to find the price in the AF_initDataCallback
    const parts = text.split(`"${ticker}"`);
    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i].substring(0, 500);
      const curMatch = chunk.match(/"([A-Z]{3})",\s*\[([\d.]+),/);
      if (curMatch) {
        return { currency: curMatch[1], price: parseFloat(curMatch[2]), name };
      }
    }

    // 2. Fallback to simpler JSON extraction
    const jsonMatch = text.match(new RegExp(`\\[\\"${ticker}\\:[^\\"]+\\",([\\d.]+)`));
    if (jsonMatch) return { price: parseFloat(jsonMatch[1]), currency: null, name };

    // 3. Fallback to HTML scraping
    const priceMatch = text.match(/class="YMlKec fxKbKc">[^0-9]*([\d,.]+)/);
    const currencyMatch = text.match(/data-currency-code="([^"]+)"/);
    
    if (priceMatch) {
      return {
        price: parseFloat(priceMatch[1].replace(/,/g, '')),
        currency: currencyMatch ? currencyMatch[1] : null,
        name
      };
    }

    return { price: null, currency: null, name };
  } catch (error) {
    console.error('[Finance] Google Finance error:', error);
    return { price: null, currency: null, name: null };
  }
}



export async function getAssetPrice(ticker: string): Promise<{ price: number | null; name: string | null; isManual?: boolean; error?: string }> {
  try {
    console.log(`[Finance] Fetching data for: ${ticker}`);
    
    // 1. Check if manual override is within 15 minutes
    try {
      const supabase = await createClient();
      const { data: asset } = await supabase
        .from('assets')
        .select('manual_price_override, manual_price_set_at, name')
        .eq('ticker', ticker)
        .single();
      
      if (asset?.manual_price_override && asset?.manual_price_set_at) {
        const minutesAgo = (Date.now() - new Date(asset.manual_price_set_at).getTime()) / 60000;
        if (minutesAgo < 15) {
          console.log(`[Finance] Using manual override for ${ticker}: ₪${asset.manual_price_override} (${minutesAgo.toFixed(1)} min ago)`);
          return { price: asset.manual_price_override, name: asset.name, isManual: true };
        }
      }
    } catch (dbError) {
      console.log(`[Finance] Could not check manual override:`, dbError);
    }
    
    // 2. Handle Israeli numeric tickers with Bizportal
    if (/^\d{6,8}$/.test(ticker)) {
      const bizResult = await getPriceFromBizportal(ticker);
      if (bizResult.price) {
        return { price: bizResult.price, name: bizResult.name, isManual: false };
      }
    }

    // 3. Try Google Finance for international stocks
    const gfResult = await getPriceFromGoogleFinance(ticker);
    if (gfResult.price) {
      let price = gfResult.price;
      const currency = gfResult.currency || 'USD';
      
      if (currency === 'USD') {
        const rate = await getUsdIlsRate();
        price *= rate;
      } else if (currency === 'ILA') {
        price /= 100;
      }
      
      console.log(`[Finance] Got price for ${ticker}: ₪${price}`);
      return { price, name: gfResult.name, isManual: false };
    }

    // 4. Fallback to Yahoo Finance
    let quote;
    try {
      quote = await yf.quote(ticker);
    } catch {
      const searchResult = await yf.search(ticker);
      if (searchResult.quotes && searchResult.quotes.length > 0) {
        const bestMatchSymbol = searchResult.quotes[0].symbol;
        if (bestMatchSymbol && typeof bestMatchSymbol === 'string') {
          quote = await yf.quote(bestMatchSymbol);
        }
      }
    }

    if (quote && quote.regularMarketPrice) {
      let price = quote.regularMarketPrice;
      const currency = (quote.currency || 'USD').toUpperCase();
      
      if (currency === 'USD') {
        const rate = await getUsdIlsRate();
        price *= rate;
      } else if (currency === 'GBp') {
        const rate = await getUsdIlsRate();
        price = (price / 100) * rate; 
      }
      
      console.log(`[Finance] Got price for ${ticker}: ₪${price}`);
      return { price, name: quote.longName || quote.shortName || null, isManual: false };
    }

    console.log(`[Finance] No price found for ${ticker} - use manual override in rebalance calculator`);
    return { price: null, name: null, error: 'Price not found - use manual override', isManual: false };
  } catch (error: any) {
    console.error('[Finance] Error:', error.message);
    return { price: null, name: null, error: error.message, isManual: false };
  }
}



// Parallel price fetching with concurrency limit
const CONCURRENT_REQUESTS = 3;

export async function fetchPricesInParallel(
  tickers: string[]
): Promise<Record<string, { price: number | null; name: string | null; isManual?: boolean; error?: string }>> {
  const results: Record<string, { price: number | null; name: string | null; isManual?: boolean; error?: string }> = {};
  
  // Split tickers into chunks for parallel processing
  const chunks = chunkArray(tickers, CONCURRENT_REQUESTS);
  
  console.log(`[Finance] Fetching ${tickers.length} prices in ${chunks.length} batches of ${CONCURRENT_REQUESTS}`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Fetch chunk in parallel using Promise.allSettled
    const promises = chunk.map(ticker => 
      getAssetPrice(ticker)
        .then(result => ({ ticker, result }))
        .catch(error => ({ 
          ticker, 
          result: { 
            price: null, 
            name: null, 
            error: error.message,
            isManual: false 
          } 
        }))
    );
    
    const chunkResults = await Promise.allSettled(promises);
    
    // Process results
    chunkResults.forEach(promiseResult => {
      if (promiseResult.status === 'fulfilled') {
        const { ticker, result } = promiseResult.value;
        results[ticker] = result;
      } else {
        console.error(`[Finance] Unexpected error in parallel fetch:`, promiseResult.reason);
      }
    });
    
    // Add small delay between batches (except for last batch)
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[Finance] Completed fetching ${tickers.length} prices`);
  return results;
}
