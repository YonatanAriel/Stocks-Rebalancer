import { NextRequest, NextResponse } from "next/server";
import { scrapeBizportalEtf } from "@/lib/scrapeBizportalEtf";

const SCRAPING_TIMEOUT = 8000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ securityId: string }> }
) {
  const { securityId } = await params;
  const startTime = Date.now();
  console.log(`[API] ========== START REQUEST ==========`);
  console.log(`[API] securityId: ${securityId}`);
  console.log(`[API] Environment: ${process.env.VERCEL_ENV || 'local'}`);
  console.log(`[API] Region: ${process.env.VERCEL_REGION || 'unknown'}`);
  console.log(`[API] Timestamp: ${new Date().toISOString()}`);

  try {
    // Race between scraping and timeout
    const data = await Promise.race([
      scrapeBizportalEtf(securityId),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Scraping timeout after 8 seconds')), SCRAPING_TIMEOUT)
      )
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`[API] ✓ SUCCESS - Duration: ${duration}ms`);
    console.log(`[API] Data summary: name=${data.name}, unitValue=${data.unitValueText}`);
    console.log(`[API] ========== END REQUEST ==========`);
    
    return NextResponse.json({ ok: true, data }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[API] ✗ FAILED - Duration: ${duration}ms`);
    console.error(`[API] Error: ${errorMsg}`);
    if (errorStack) {
      console.error(`[API] Stack: ${errorStack}`);
    }
    console.log(`[API] ========== END REQUEST ==========`);
    
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
