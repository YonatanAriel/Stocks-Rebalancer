import { NextRequest, NextResponse } from "next/server";
import { getAssetPrice } from "@/actions/finance";
import { scrapeBizportalEtf } from "@/lib/scrapeBizportalEtf";
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  
  try {
    // Get basic price data
    const { price, name } = await getAssetPrice(ticker);
    
    if (!price) {
      return NextResponse.json(
        { error: "Price not found" },
        { status: 404 }
      );
    }
    
    // Check if it's an Israeli security (numeric ticker)
    const isIsraeliSecurity = /^\d{6,8}$/.test(ticker);
    
    let detailData: any = {
      ticker,
      name: name || ticker,
      price,
    };
    
    // If Israeli security, try to get additional data from Bizportal
    if (isIsraeliSecurity) {
      try {
        const bizData = await scrapeBizportalEtf(ticker);
        
        // Add performance data if available
        if (bizData.monthReturnText || bizData.threeMonthReturnText || bizData.yearReturnText || bizData.twelveMonthReturnText) {
          detailData.performance = {
            oneMonth: bizData.monthReturnText,
            threeMonth: bizData.threeMonthReturnText,
            ytd: bizData.yearReturnText,
            oneYear: bizData.twelveMonthReturnText,
          };
        }
        
        // Add change data if available
        if (bizData.changeText) {
          const changeMatch = bizData.changeText.match(/([-+]?[\d.]+)%?/);
          if (changeMatch) {
            detailData.changePercent = parseFloat(changeMatch[1]);
          }
        }
        
        // Add last updated date
        if (bizData.asOf) {
          detailData.lastUpdated = bizData.asOf;
        }
        
        // Add turnover/volume if available
        if (bizData.turnoverText) {
          detailData.overview = {
            ...detailData.overview,
            volume: bizData.turnoverText,
          };
        }
      } catch (error) {
        console.error(`[API] Failed to fetch Bizportal details for ${ticker}:`, error);
        // Continue without additional data
      }
    } else {
      try {
        const quote = await yf.quote(ticker);
        
        const usdIlsRate = await yf.quote('ILS=X').then(q => q.regularMarketPrice || 3.7).catch(() => 3.7);
        
        if (quote.regularMarketChangePercent !== undefined) {
          detailData.changePercent = quote.regularMarketChangePercent;
        }
        
        detailData.overview = {
          marketCap: quote.marketCap ? `$${(quote.marketCap / 1e9).toFixed(2)}B` : undefined,
          volume: quote.regularMarketVolume ? quote.regularMarketVolume.toLocaleString() : undefined,
          avgVolume: quote.averageDailyVolume3Month ? quote.averageDailyVolume3Month.toLocaleString() : undefined,
          high52Week: quote.fiftyTwoWeekHigh ? quote.fiftyTwoWeekHigh * usdIlsRate : undefined,
          low52Week: quote.fiftyTwoWeekLow ? quote.fiftyTwoWeekLow * usdIlsRate : undefined,
          beta: quote.beta,
          peRatio: quote.trailingPE,
          dividendYield: quote.dividendYield ? `${(quote.dividendYield * 100).toFixed(2)}%` : undefined,
        };
        
        try {
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          const ytdStart = new Date(now.getFullYear(), 0, 1);
          const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          
          const historical = await yf.historical(ticker, {
            period1: oneYearAgo,
            period2: now,
            interval: '1d'
          });
          
          if (historical && historical.length > 0) {
            const currentPrice = quote.regularMarketPrice || price;
            
            const ytdPrice = historical.find(d => new Date(d.date) >= ytdStart)?.close;
            const oneMonthPrice = historical.find(d => new Date(d.date) >= oneMonthAgo)?.close;
            const threeMonthPrice = historical.find(d => new Date(d.date) >= threeMonthsAgo)?.close;
            const oneYearPrice = historical[0]?.close;
            
            detailData.performance = {
              oneMonth: oneMonthPrice ? `${(((currentPrice - oneMonthPrice) / oneMonthPrice) * 100).toFixed(2)}%` : undefined,
              threeMonth: threeMonthPrice ? `${(((currentPrice - threeMonthPrice) / threeMonthPrice) * 100).toFixed(2)}%` : undefined,
              ytd: ytdPrice ? `${(((currentPrice - ytdPrice) / ytdPrice) * 100).toFixed(2)}%` : undefined,
              oneYear: oneYearPrice ? `${(((currentPrice - oneYearPrice) / oneYearPrice) * 100).toFixed(2)}%` : undefined,
            };
          }
        } catch (histError) {
          console.error(`[API] Failed to fetch historical data for ${ticker}:`, histError);
        }
      } catch (error) {
        console.error(`[API] Failed to fetch Yahoo Finance details for ${ticker}:`, error);
      }
    }
    
    return NextResponse.json(detailData, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[API] Error fetching stock details for ${ticker}:`, errorMsg);
    
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
