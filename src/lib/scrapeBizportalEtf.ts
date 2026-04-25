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
  // Look for keys that contain the price pattern (number with optional comma)
  // The price is typically in a key like "ISHARES CORE S&P 500 UCITS ETF 228,750-0.58%שווי יחידה-- נכון ל"
  console.log(`[Bizportal] Searching for price in ${Object.keys(rawPairs).length} raw pairs`);
  
  for (const key of Object.keys(rawPairs)) {
    // Match pattern: number with commas and optional decimals, followed by minus/plus and percentage
    // e.g., "228,750-0.58%" or "34,050-0.73%"
    const match = key.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)[+-]?\d*\.?\d*%/);
    if (match) {
      console.log(`[Bizportal] Found price in key: "${key.substring(0, 80)}" -> "${match[1]}"`);
      return match[1];
    }
  }
  
  // For mutual funds, try to find price in the values
  for (const [key, value] of Object.entries(rawPairs)) {
    // Look for patterns like "1,108.46" (price format)
    if (key.includes("שווי") || key.includes("מחיר")) {
      const match = value.match(/(\d{1,3}(?:,\d{3})*\.?\d+)/);
      if (match) {
        console.log(`[Bizportal] Found price in value for key "${key}": "${match[1]}"`);
        return match[1];
      }
    }
  }
  
  console.log(`[Bizportal] No price found in raw pairs`);
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
  console.log(`[Bizportal] ===== SCRAPING START: ${securityId} =====`);
  
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  
  // Try both ETF and mutual fund URLs
  const urls = [
    { url: `https://www.bizportal.co.il/tradedfund/quote/profile/${securityId}`, type: 'ETF' },
    { url: `https://www.bizportal.co.il/mutualfunds/quote/profile/${securityId}`, type: 'Mutual Fund' },
  ];

  let html = "";
  let lastError: Error | null = null;
  let successUrl = "";

  for (const { url: sourceUrl, type } of urls) {
    const urlStartTime = Date.now();
    
    try {
      console.log(`[Bizportal] Attempting ${type}: ${sourceUrl}`);
      
      let fetchUrl: string;
      let fetchOptions: RequestInit;
      
      if (scraperApiKey) {
        fetchUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(sourceUrl)}&country_code=il`;
        fetchOptions = {
          method: 'GET',
          cache: 'no-store' as RequestCache,
        };
        console.log(`[Bizportal] Using ScraperAPI proxy`);
      } else {
        fetchUrl = sourceUrl;
        fetchOptions = {
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "accept-language": "he-IL,he;q=0.9,en;q=0.8",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "referer": "https://www.bizportal.co.il/",
          },
          cache: 'no-store' as RequestCache,
        };
        console.warn(`[Bizportal] ⚠ No SCRAPER_API_KEY - using direct fetch (may fail in production)`);
      }

      const res = await fetch(fetchUrl, fetchOptions);

      const fetchDuration = Date.now() - urlStartTime;
      console.log(`[Bizportal] Fetch completed in ${fetchDuration}ms - Status: ${res.status}`);

      if (!res.ok) {
        console.log(`[Bizportal] ✗ ${type} failed with status ${res.status}`);
        lastError = new Error(`Bizportal request failed: ${res.status}`);
        continue;
      }

      html = await res.text();
      const textDuration = Date.now() - urlStartTime;
      console.log(`[Bizportal] ✓ ${type} success - HTML: ${html.length} bytes in ${textDuration}ms`);
      successUrl = sourceUrl;
      break; // Success, exit loop
    } catch (error) {
      const errorDuration = Date.now() - urlStartTime;
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Bizportal] ✗ ${type} exception after ${errorDuration}ms: ${lastError.message}`);
      continue;
    }
  }

  if (!html) {
    const totalDuration = Date.now() - fetchStartTime;
    console.error(`[Bizportal] ✗✗✗ ALL URLS FAILED after ${totalDuration}ms`);
    console.error(`[Bizportal] Last error: ${lastError?.message}`);
    throw lastError || new Error("Failed to fetch from Bizportal");
  }

  console.log(`[Bizportal] Using URL: ${successUrl}`);

  console.log(`[Bizportal] Using URL: ${successUrl}`);
  const sourceUrl = successUrl || urls[0].url; // Use successful URL or first URL for reference
  const $ = cheerio.load(html);

  const rawPairs = collectLabelValuePairs($);
  console.log(`[Bizportal] Collected ${Object.keys(rawPairs).length} label-value pairs`);
  if (Object.keys(rawPairs).length > 0) {
    console.log(`[Bizportal] Sample keys:`, Object.keys(rawPairs).slice(0, 5));
  } else {
    console.warn(`[Bizportal] ⚠ WARNING: No label-value pairs found!`);
  }

  const name =
    clean($("h1").first().text()) ||
    clean($("title").text()?.split(" - ")[0]) ||
    null;
  console.log(`[Bizportal] Name: "${name}"`);

  const asOf =
    pickValueNearLabel($, "נכון ל") || rawPairs["נכון ל"] || null;
  console.log(`[Bizportal] asOf: "${asOf}"`);

  const unitValueText =
    (pickValueNearLabel($, "שווי יחידה") !== "--" ? pickValueNearLabel($, "שווי יחידה") : null) ||
    (rawPairs["שווי יחידה"] !== "--" ? rawPairs["שווי יחידה"] : null) ||
    (pickValueNearLabel($, "מחיר פדיון") !== "--" ? pickValueNearLabel($, "מחיר פדיון") : null) ||
    (rawPairs["מחיר פדיון"] !== "--" ? rawPairs["מחיר פדיון"] : null) ||
    extractPriceFromRawPairs(rawPairs) ||
    null;
  console.log(`[Bizportal] unitValueText: "${unitValueText}"`);

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
  console.log(`[Bizportal] ===== SCRAPING COMPLETE: ${totalDuration}ms =====`);

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
