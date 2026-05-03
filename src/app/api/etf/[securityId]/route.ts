import { NextRequest, NextResponse } from "next/server";
import { scrapeBizportalEtf } from "@/lib/scrapeBizportalEtf";

const SCRAPING_TIMEOUT = 8000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ securityId: string }> }
) {
  const { securityId } = await params;
  const startTime = Date.now();
  console.log(`[API] ETF route called for securityId: ${securityId}`);

  try {
    console.log(`[API] Starting scrape with ${SCRAPING_TIMEOUT}ms timeout`);
    const data = await Promise.race([
      scrapeBizportalEtf(securityId),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Scraping timeout after 8 seconds')), SCRAPING_TIMEOUT)
      )
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Scrape successful in ${duration}ms`);
    
    return NextResponse.json({ ok: true, data }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[API] Scrape failed after ${duration}ms: ${errorMsg}`);
    
    return NextResponse.json(
      {
        ok: false,
        error: errorMsg,
        duration,
        securityId,
      },
      { status: 500 }
    );
  }
}
