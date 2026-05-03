import * as cheerio from "cheerio";

export type BizportalEtfSnapshot = {
  securityId: string;
  sourceUrl: string;
  name: string | null;
  asOf: string | null;
  unitValueText: string | null;
  changeText: string | null;
  turnoverText: string | null;
  monthReturnText: string | null;
  yearReturnText: string | null;
  threeMonthReturnText: string | null;
  twelveMonthReturnText: string | null;
  standardDeviationText: string | null;
  sharpeRatioText: string | null;
  rawPairs: Record<string, string>;
};

function clean(text?: string | null) {
  return text?.replace(/\s+/g, " ").trim() || null;
}

function pickValueNearLabel($: cheerio.CheerioAPI, label: string) {
  const nodes = $(`*:contains("${label}")`).toArray();

  for (const node of nodes) {
    const el = $(node);
    const text = clean(el.text());
    if (text === label) {
      const parentText = clean(el.parent().text());
      if (parentText && parentText !== label) {
        const candidate = parentText.replace(label, "").trim();
        if (candidate) return candidate;
      }

      const nextText = clean(el.next().text());
      if (nextText) return nextText;

      const parent = el.parent();
      const kids = parent
        .children()
        .toArray()
        .map((x) => clean($(x).text()))
        .filter(Boolean) as string[];
      const idx = kids.indexOf(label);
      if (idx >= 0 && kids[idx + 1]) return kids[idx + 1];
    } else if (text?.startsWith(label)) {
      return clean(text.replace(label, "").replace(/^[:：]/, ""));
    }
  }

  return null;
}

function extractPriceFromRawPairs(rawPairs: Record<string, string>): string | null {
  for (const key of Object.keys(rawPairs)) {
    const match = key.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)[+-]?\d*\.?\d*%/);
    if (match) {
      return match[1];
    }
  }
  
  for (const [key, value] of Object.entries(rawPairs)) {
    if (key.includes("שווי") || key.includes("מחיר")) {
      const match = value.match(/(\d{1,3}(?:,\d{3})*\.?\d+)/);
      if (match) {
        return match[1];
      }
    }
  }
  
  return null;
}

function collectLabelValuePairs($: cheerio.CheerioAPI) {
  const result: Record<string, string> = {};

  $("li, div, span, td").each((_, node) => {
    const text = clean($(node).text());
    if (!text) return;

    const match = text.match(/^([^:]{1,80}):\s*(.+)$/);
    if (!match) return;

    const key = clean(match[1]);
    const value = clean(match[2]);

    if (key && value && !result[key]) {
      result[key] = value;
    }
  });

  return result;
}

export async function scrapeBizportalEtf(
  securityId: string
): Promise<BizportalEtfSnapshot> {
  const fetchStartTime = Date.now();
  console.log(`[Bizportal] ========== SCRAPE START ==========`);
  console.log(`[Bizportal] Security ID: ${securityId}`);
  console.log(`[Bizportal] Timestamp: ${new Date().toISOString()}`);
  
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  console.log(`[Bizportal] SCRAPER_API_KEY exists: ${!!scraperApiKey}`);
  if (scraperApiKey) {
    console.log(`[Bizportal] SCRAPER_API_KEY length: ${scraperApiKey.length}`);
    console.log(`[Bizportal] SCRAPER_API_KEY first 10 chars: ${scraperApiKey.substring(0, 10)}...`);
  }
  
  const urls = [
    { url: `https://www.bizportal.co.il/tradedfund/quote/profile/${securityId}`, type: 'ETF' },
    { url: `https://www.bizportal.co.il/mutualfunds/quote/profile/${securityId}`, type: 'Mutual Fund' },
  ];

  let html = "";
  let lastError: Error | null = null;
  let successUrl = "";
  let attemptCount = 0;

  for (const { url: sourceUrl, type } of urls) {
    attemptCount++;
    const urlStartTime = Date.now();
    console.log(`[Bizportal] --- Attempt ${attemptCount}: ${type} ---`);
    console.log(`[Bizportal] Source URL: ${sourceUrl}`);
    
    try {
      let fetchUrl: string;
      let fetchOptions: RequestInit;
      let method = 'unknown';
      
      // Try ScraperAPI first if key is available
      if (scraperApiKey) {
        method = 'ScraperAPI';
        fetchUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(sourceUrl)}&country_code=il`;
        console.log(`[Bizportal] Method: ${method}`);
        console.log(`[Bizportal] Fetch URL: ${fetchUrl.substring(0, 120)}...`);
        fetchOptions = {
          method: 'GET',
          cache: 'no-store' as RequestCache,
        };

        try {
          console.log(`[Bizportal] Initiating fetch...`);
          const fetchStartMs = Date.now();
          const res = await fetch(fetchUrl, fetchOptions);
          const fetchDuration = Date.now() - fetchStartMs;
          
          console.log(`[Bizportal] Fetch completed`);
          console.log(`[Bizportal] Status: ${res.status}`);
          console.log(`[Bizportal] Status Text: ${res.statusText}`);
          console.log(`[Bizportal] Duration: ${fetchDuration}ms`);
          console.log(`[Bizportal] Headers: ${JSON.stringify(Object.fromEntries(res.headers.entries()))}`);

          if (res.ok) {
            html = await res.text();
            console.log(`[Bizportal] ✓ ScraperAPI SUCCESS - HTML length: ${html.length} bytes`);
            successUrl = sourceUrl;
            break;
          } else {
            console.log(`[Bizportal] ✗ ScraperAPI failed with status ${res.status}`);
            console.log(`[Bizportal] Response body (first 500 chars): ${(await res.text()).substring(0, 500)}`);
            console.log(`[Bizportal] Falling back to direct fetch...`);
          }
        } catch (scraperError) {
          const errorMsg = scraperError instanceof Error ? scraperError.message : String(scraperError);
          console.log(`[Bizportal] ✗ ScraperAPI exception: ${errorMsg}`);
          console.log(`[Bizportal] Error stack: ${scraperError instanceof Error ? scraperError.stack : 'N/A'}`);
          console.log(`[Bizportal] Falling back to direct fetch...`);
        }
      }

      // Fallback to direct fetch
      method = 'Direct Fetch';
      fetchUrl = sourceUrl;
      console.log(`[Bizportal] Method: ${method}`);
      console.log(`[Bizportal] Fetch URL: ${fetchUrl}`);
      fetchOptions = {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "accept-language": "he-IL,he;q=0.9,en;q=0.8",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "referer": "https://www.bizportal.co.il/",
        },
        cache: 'no-store' as RequestCache,
      };
      console.log(`[Bizportal] Headers: ${JSON.stringify(fetchOptions.headers)}`);

      console.log(`[Bizportal] Initiating direct fetch...`);
      const directFetchStart = Date.now();
      const res = await fetch(fetchUrl, fetchOptions);
      const fetchDuration = Date.now() - directFetchStart;
      
      console.log(`[Bizportal] Direct fetch completed`);
      console.log(`[Bizportal] Status: ${res.status}`);
      console.log(`[Bizportal] Status Text: ${res.statusText}`);
      console.log(`[Bizportal] Duration: ${fetchDuration}ms`);
      console.log(`[Bizportal] Content-Type: ${res.headers.get('content-type')}`);
      console.log(`[Bizportal] Content-Length: ${res.headers.get('content-length')}`);

      if (!res.ok) {
        lastError = new Error(`Bizportal request failed: ${res.status} ${res.statusText}`);
        console.log(`[Bizportal] ✗ Direct fetch failed: ${lastError.message}`);
        const bodyPreview = await res.text();
        console.log(`[Bizportal] Response body (first 300 chars): ${bodyPreview.substring(0, 300)}`);
        continue;
      }

      html = await res.text();
      console.log(`[Bizportal] ✓ Direct fetch SUCCESS - HTML length: ${html.length} bytes`);
      console.log(`[Bizportal] HTML preview (first 200 chars): ${html.substring(0, 200)}`);
      successUrl = sourceUrl;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Bizportal] ✗ Exception: ${lastError.message}`);
      console.error(`[Bizportal] Error type: ${error?.constructor?.name}`);
      console.error(`[Bizportal] Stack: ${lastError.stack}`);
      continue;
    }
  }

  if (!html) {
    console.error(`[Bizportal] ========== SCRAPE FAILED ==========`);
    console.error(`[Bizportal] Failed to fetch HTML for ${securityId}`);
    console.error(`[Bizportal] Last error: ${lastError?.message}`);
    console.error(`[Bizportal] Total attempts: ${attemptCount}`);
    throw lastError || new Error("Failed to fetch from Bizportal");
  }
  
  console.log(`[Bizportal] HTML fetched successfully, starting parse...`);

  const sourceUrl = successUrl || urls[0].url;
  const $ = cheerio.load(html);

  const rawPairs = collectLabelValuePairs($);
  console.log(`[Bizportal] Parsing complete`);
  console.log(`[Bizportal] Collected ${Object.keys(rawPairs).length} label-value pairs`);
  if (Object.keys(rawPairs).length > 0) {
    console.log(`[Bizportal] Sample pairs (first 5):`);
    Object.entries(rawPairs).slice(0, 5).forEach(([k, v]) => {
      console.log(`[Bizportal]   "${k}" => "${v}"`);
    });
  } else {
    console.log(`[Bizportal] ⚠️ WARNING: No label-value pairs found!`);
  }

  const name =
    clean($("h1").first().text()) ||
    clean($("title").text()?.split(" - ")[0]) ||
    null;
  console.log(`[Bizportal] Extracted name: "${name}"`);

  const asOf =
    pickValueNearLabel($, "נכון ל") || rawPairs["נכון ל"] || null;
  console.log(`[Bizportal] Extracted asOf: "${asOf}"`);

  const unitValueText =
    (pickValueNearLabel($, "שווי יחידה") !== "--" ? pickValueNearLabel($, "שווי יחידה") : null) ||
    (rawPairs["שווי יחידה"] !== "--" ? rawPairs["שווי יחידה"] : null) ||
    (pickValueNearLabel($, "מחיר פדיון") !== "--" ? pickValueNearLabel($, "מחיר פדיון") : null) ||
    (rawPairs["מחיר פדיון"] !== "--" ? rawPairs["מחיר פדיון"] : null) ||
    extractPriceFromRawPairs(rawPairs) ||
    null;
  console.log(`[Bizportal] Extracted unitValueText: "${unitValueText}"`);
  if (!unitValueText) {
    console.log(`[Bizportal] ⚠️ WARNING: No unit value found! Checking all keys for price-like values...`);
    Object.entries(rawPairs).forEach(([k, v]) => {
      if (v && /[\d,]+\.?\d+/.test(v)) {
        console.log(`[Bizportal]   Potential price in "${k}": "${v}"`);
      }
    });
  }

  const changeText = pickValueNearLabel($, "שינוי") || null;
  const turnoverText =
    pickValueNearLabel($, "תמורה") || rawPairs["תמורה"] || null;
  const monthReturnText =
    pickValueNearLabel($, "% החודש") || rawPairs["% החודש"] || null;
  const yearReturnText =
    pickValueNearLabel($, "% השנה") || rawPairs["% השנה"] || null;
  const threeMonthReturnText =
    pickValueNearLabel($, "% 3 חודשים") ||
    rawPairs["% 3 חודשים"] ||
    null;
  const twelveMonthReturnText =
    pickValueNearLabel($, "% 12 חודשים") ||
    rawPairs["% 12 חודשים"] ||
    null;
  
  const standardDeviationText =
    pickValueNearLabel($, "סטיית תקן") || 
    rawPairs["סטיית תקן"] || 
    null;
  
  const sharpeRatioText =
    pickValueNearLabel($, "שארפ (שנה)") || 
    rawPairs["שארפ (שנה)"] ||
    pickValueNearLabel($, "שארפ") || 
    rawPairs["שארפ"] ||
    null;

  const totalDuration = Date.now() - fetchStartTime;
  console.log(`[Bizportal] ========== SCRAPE SUCCESS ==========`);
  console.log(`[Bizportal] Total duration: ${totalDuration}ms`);
  console.log(`[Bizportal] Final result:`);
  console.log(`[Bizportal]   name: "${name}"`);
  console.log(`[Bizportal]   price: "${unitValueText}"`);
  console.log(`[Bizportal]   asOf: "${asOf}"`);
  console.log(`[Bizportal]   change: "${changeText}"`);
  console.log(`[Bizportal] ========== END ==========`);

  return {
    securityId,
    sourceUrl,
    name,
    asOf,
    unitValueText,
    changeText,
    turnoverText,
    monthReturnText,
    yearReturnText,
    threeMonthReturnText,
    twelveMonthReturnText,
    standardDeviationText,
    sharpeRatioText,
    rawPairs,
  };
}
