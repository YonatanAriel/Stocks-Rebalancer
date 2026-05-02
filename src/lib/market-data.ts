const indicatorCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function getTechnicalIndicators(ticker: string) {
  const cacheKey = `indicators:${ticker}`;
  const cached = indicatorCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Cache Hit] Technical indicators for ${ticker}`);
    return cached.data;
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not set");
  }

  try {
    const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${ticker}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`;
    const rsiResponse = await fetch(rsiUrl);
    const rsiData = await rsiResponse.json();

    const macdUrl = `https://www.alphavantage.co/query?function=MACD&symbol=${ticker}&interval=daily&series_type=close&apikey=${apiKey}`;
    const macdResponse = await fetch(macdUrl);
    const macdData = await macdResponse.json();

    const rsiValues = rsiData["Technical Analysis: RSI"];
    const macdValues = macdData["Technical Analysis: MACD"];

    if (!rsiValues || !macdValues) {
      throw new Error(`No data returned for ${ticker}. Check if ticker is valid.`);
    }

    const latestRsiDate = Object.keys(rsiValues)[0];
    const latestMacdDate = Object.keys(macdValues)[0];

    const rsi = parseFloat(rsiValues[latestRsiDate]["RSI"]);
    const macdValue = parseFloat(macdValues[latestMacdDate]["MACD"]);
    const macdSignal = parseFloat(macdValues[latestMacdDate]["MACD_Signal"]);

    let signal: "overbought" | "oversold" | "neutral";
    if (rsi > 70) {
      signal = "overbought";
    } else if (rsi < 30) {
      signal = "oversold";
    } else {
      signal = "neutral";
    }

    const result = {
      ticker,
      rsi,
      macdValue,
      macdSignal,
      signal,
      timestamp: new Date().toISOString(),
    };

    indicatorCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error(`Error fetching technical indicators for ${ticker}:`, error);
    throw error;
  }
}

export async function getSentimentData(ticker: string) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  try {
    const url = `https://finnhub.io/api/v1/news-sentiment?symbol=${ticker}&token=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Finnhub error: ${data.error}`);
    }

    const sentimentScore = data.companyNewsScore || 0;
    const bullishPercent = data.sentiment?.bullishPercent || 0;
    const bearishPercent = data.sentiment?.bearishPercent || 0;
    const articlesInLastWeek = data.buzz?.articlesInLastWeek || 0;

    let sentimentSignal: "bullish" | "bearish" | "neutral";
    if (sentimentScore > 0.6) {
      sentimentSignal = "bullish";
    } else if (sentimentScore < 0.4) {
      sentimentSignal = "bearish";
    } else {
      sentimentSignal = "neutral";
    }

    return {
      ticker,
      sentimentScore,
      bullishPercent,
      bearishPercent,
      articlesInLastWeek,
      sentimentSignal,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching sentiment data for ${ticker}:`, error);
    throw error;
  }
}

export async function getMarketAnalysis(ticker: string) {
  try {
    const [indicators, sentiment] = await Promise.all([
      getTechnicalIndicators(ticker),
      getSentimentData(ticker),
    ]);

    return {
      ticker,
      indicators,
      sentiment,
      analysis: {
        technicalSignal: indicators.signal,
        sentimentSignal: sentiment.sentimentSignal,
        overallSignal:
          indicators.signal === "overbought" || sentiment.sentimentSignal === "bearish"
            ? "cautious"
            : indicators.signal === "oversold" || sentiment.sentimentSignal === "bullish"
              ? "optimistic"
              : "neutral",
      },
    };
  } catch (error) {
    console.error(`Error getting market analysis for ${ticker}:`, error);
    throw error;
  }
}

export function clearCache() {
  indicatorCache.clear();
}
