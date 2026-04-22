import { NextRequest, NextResponse } from "next/server";
import { scrapeBizportalEtf } from "@/lib/scrapeBizportalEtf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ securityId: string }> }
) {
  const { securityId } = await params;
  console.log(`[API] ETF endpoint called with securityId: ${securityId}`);

  try {
    const data = await scrapeBizportalEtf(securityId);
    console.log(`[API] Scraping successful, returning data`);
    return NextResponse.json({ ok: true, data }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[API] Scraping failed: ${errorMsg}`);
    return NextResponse.json(
      {
        ok: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
