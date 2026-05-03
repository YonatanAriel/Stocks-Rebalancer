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
  console.log(`[Bizportal] Starting scrape for security ID: ${securityId}`);
  
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  console.log(`[Bizportal] SCRAPER_API_KEY configured: ${!!scraperApiKey}`);
  
  const urls = [
    { url: `https://www.bizportal.co.il/tradedfund/quote/profile/${securityId}`, type: 'ETF' },
    { url: `https://www.bizportal.co.il/mutualfunds/quote/profile/${securityId}`, type: 'Mutual Fund' },
  ];

  let html = "";
  let lastError: Error | null = null;
  let successUrl = "";

  for (const { url: sourceUrl, type } of urls) {
    const urlStartTime = Date.now();
    console.log(`[Bizportal] Attempting to fetch ${type} from: ${sourceUrl}`);
    
    try {
      let fetchUrl: string;
      let fetchOptions: RequestInit;
      
      if (scraperApiKey) {
        fetchUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(sourceUrl)}&country_code=il`;
        console.log(`[Bizportal] Using ScraperAPI for ${type}`);
        fetchOptions = {
          method: 'GET',
          cache: 'no-store' as RequestCache,
        };
      } else {
        fetchUrl = sourceUrl;
        console.log(`[Bizportal] Using direct fetch for ${type} (no ScraperAPI key)`);
        fetchOptions = {
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "accept-language": "he-IL,he;q=0.9,en;q=0.8",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "referer": "https://www.bizportal.co.il/",
          },
          cache: 'no-store' as RequestCache,
        };
      }

      console.log(`[Bizportal] Fetching from: ${fetchUrl.substring(0, 100)}...`);
      const res = await fetch(fetchUrl, fetchOptions);
      const fetchDuration = Date.now() - urlStartTime;
      console.log(`[Bizportal] Fetch completed in ${fetchDuration}ms with status: ${res.status}`);

      if (!res.ok) {
        lastError = new Error(`Bizportal request failed: ${res.status}`);
        console.log(`[Bizportal] Error: ${lastError.message}`);
        continue;
      }

      html = await res.text();
      console.log(`[Bizportal] Successfully fetched HTML, length: ${html.length} bytes`);
      successUrl = sourceUrl;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Bizportal] Exception during fetch: ${lastError.message}`);
      continue;
    }
  }

  if (!html) {
    console.error(`[Bizportal] Failed to fetch HTML for ${securityId}. Last error: ${lastError?.message}`);
    throw lastError || new Error("Failed to fetch from Bizportal");
  }
  
  console.log(`[Bizportal] HTML fetched successfully, parsing...`);

  const sourceUrl = successUrl || urls[0].url;
  const $ = cheerio.load(html);

  const rawPairs = collectLabelValuePairs($);
  console.log(`[Bizportal] Collected ${Object.keys(rawPairs).length} label-value pairs`);
  console.log(`[Bizportal] Raw pairs keys: ${Object.keys(rawPairs).slice(0, 5).join(', ')}...`);

  const name =
    clean($("h1").first().text()) ||
    clean($("title").text()?.split(" - ")[0]) ||
    null;
  console.log(`[Bizportal] Extracted name: ${name}`);

  const asOf =
    pickValueNearLabel($, "נכון ל") || rawPairs["נכון ל"] || null;
  console.log(`[Bizportal] Extracted asOf: ${asOf}`);

  const unitValueText =
    (pickValueNearLabel($, "שווי יחידה") !== "--" ? pickValueNearLabel($, "שווי יחידה") : null) ||
    (rawPairs["שווי יחידה"] !== "--" ? rawPairs["שווי יחידה"] : null) ||
    (pickValueNearLabel($, "מחיר פדיון") !== "--" ? pickValueNearLabel($, "מחיר פדיון") : null) ||
    (rawPairs["מחיר פדיון"] !== "--" ? rawPairs["מחיר פדיון"] : null) ||
    extractPriceFromRawPairs(rawPairs) ||
    null;
  console.log(`[Bizportal] Extracted unitValueText: ${unitValueText}`);

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
  console.log(`[Bizportal] Scrape completed in ${totalDuration}ms for ${securityId}`);
  console.log(`[Bizportal] Final result - name: ${name}, price: ${unitValueText}, asOf: ${asOf}`);

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
