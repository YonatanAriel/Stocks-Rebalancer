'use server'

import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/utils/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'


const yf = new YahooFinance()

const REQUEST_TIMEOUT = 8000;

function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), ms)
  );
}

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
    return price;
  } catch (error) {
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
      return { ok: false, error: error.message };
    }
    
    return { ok: true };
  } catch (error: any) {
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
      return { ok: false, error: error.message };
    }
    
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

async function getPriceFromBizportal(ticker: string): Promise<{ price: number | null; name: string | null }> {
  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/etf/${ticker}`;
    
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      return { price: null, name: null };
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { price: null, name: null };
    }
    
    const json = await response.json();
    
    const { ok, data } = json;
    if (!ok || !data) {
      return { price: null, name: null };
    }
    
    let price: number | null = null;
    if (data.unitValueText) {
      const match = data.unitValueText.match(/([\d,]+\.?\d*)/);
      
      if (match) {
        const priceStr = match[1].replace(/,/g, '');
        price = parseFloat(priceStr);
      }
    }
    
    if (price) {
      price = price / 100;
      return { price, name: data.name };
    }
    
    return { price: null, name: null };
  } catch (error) {
    return { price: null, name: null };
  }
}

async function getPriceFromGoogleFinance(ticker: string): Promise<{ price: number | null; currency: string | null; name: string | null }> {
  try {
    const exchanges = [/^\d+$/.test(ticker) ? 'TLV' : 'NASDAQ', 'NYSE', 'TLV'];
    let text = '';
    let foundExchange = '';

    const scraperApiKey = process.env.SCRAPER_API_KEY;

    for (const ex of exchanges) {
      const sourceUrl = `https://www.google.com/finance/quote/${ticker}:${ex}`;
      let fetchUrl = sourceUrl;
      let fetchOptions: RequestInit = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 60 }
      };

      if (scraperApiKey) {
        fetchUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(sourceUrl)}`;
        fetchOptions = { next: { revalidate: 60 } };
      }

      const response = await fetch(fetchUrl, fetchOptions);
      
      if (response.ok) {
        text = await response.text();
        if (text.includes(ticker)) {
          foundExchange = ex;
          break;
        }
      }
    }

    if (!text) return { price: null, currency: null, name: null };

    const nameMatch = text.match(/<div class="zz3gNc">([^<]+)<\/div>/) || text.match(/<div class="yf_ticker_name">([^<]+)<\/div>/);
    const name = nameMatch ? nameMatch[1] : null;

    const parts = text.split(`"${ticker}"`);
    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i].substring(0, 500);
      const curMatch = chunk.match(/"([A-Z]{3})",\s*\[([\d.]+),/);
      if (curMatch) {
        return { currency: curMatch[1], price: parseFloat(curMatch[2]), name };
      }
    }

    const jsonMatch = text.match(new RegExp(`\\[\\"${ticker}\\:[^\\"]+\\",([\\d.]+)`));
    if (jsonMatch) return { price: parseFloat(jsonMatch[1]), currency: null, name };

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
    return { price: null, currency: null, name: null };
  }
}



export async function getAssetPrice(ticker: string): Promise<{ price: number | null; name: string | null; isManual?: boolean; error?: string }> {
  try {
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
          return { price: asset.manual_price_override, name: asset.name, isManual: true };
        }
      }
    } catch (dbError) {
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
      
      return { price, name: quote.longName || quote.shortName || null, isManual: false };
    }

    return { price: null, name: null, error: 'Price not found - use manual override', isManual: false };
  } catch (error: any) {
    return { price: null, name: null, error: error.message, isManual: false };
  }
}



const CONCURRENT_REQUESTS = 3;

export async function fetchPricesInParallel(
  tickers: string[]
): Promise<Record<string, { price: number | null; name: string | null; isManual?: boolean; error?: string }>> {
  const results: Record<string, { price: number | null; name: string | null; isManual?: boolean; error?: string }> = {};
  
  // Split tickers into chunks for parallel processing
  const chunks = chunkArray(tickers, CONCURRENT_REQUESTS);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
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
    
    chunkResults.forEach(promiseResult => {
      if (promiseResult.status === 'fulfilled') {
        const { ticker, result } = promiseResult.value;
        results[ticker] = result;
      } else {
      }
    });
    
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
