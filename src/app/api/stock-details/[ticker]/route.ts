import { NextRequest, NextResponse } from "next/server";
import { getAssetPrice } from "@/actions/finance";
import { scrapeBizportalEtf } from "@/lib/scrapeBizportalEtf";

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
