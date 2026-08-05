import { NextRequest, NextResponse } from 'next/server';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooData {
  price: number;
  companyName: string;
  symbol: string;
  candles: Candle[];
}

const HARDCODED_MAPPING: Record<string, string> = {
  'MYEG': '0138.KL',
  'MAYBANK': '1155.KL',
  'CIMB': '1023.KL',
  'TENAGA': '5347.KL',
  'PBBANK': '1295.KL',
  'IHH': '5225.KL',
  'AXIATA': '6888.KL',
  'MAXIS': '6012.KL',
  'AMBANK': '1015.KL',
  'NESTLE': '4707.KL',
  'INARI': '0166.KL',
  'UEMS': '5148.KL',
  'GENETEC': '0104.KL',
  'ZETRIX': '0138.KL',
  'GIIB': '7192.KL',
  'SFPTECH': '0251.KL',
  'SUM': '0459.KL',
  'OPPSTAR': '0275.KL',
  'EIPOWER': '0228.KL',
  'NE': '0325.KL',
  'MCLEAN': '0167.KL',
  'ICENTS': '0200.KL',
  'CPETECH': '5317.KL',
  'OGX': '0327.KL',
  'MNHLDG': '0245.KL',
  'MNRB': '6459.KL',
  'NATGATE': '0270.KL',
  'SKPRES': '7155.KL',
  'SPSETIA': '8664.KL',
  'DNEX': '4456.KL',
  'JCY': '5161.KL',
  'QES': '0196.KL',
  'WTK': '4243.KL',
  'AEMULUS': '0181.KL',
  'VIS': '0035.KL'
};

async function resolveSymbol(name: string): Promise<string | null> {
  let query = name.trim().toUpperCase();
  if (HARDCODED_MAPPING[query]) return HARDCODED_MAPPING[query];

  if (/^\d{4,5}$/.test(query)) return `${query}.KL`;

  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const quotes = data.quotes || [];

    const klseStock = quotes.find((q: any) => q.exchange === 'KLS' || q.symbol?.endsWith('.KL'));
    if (klseStock) {
      return klseStock.symbol;
    }

    if (quotes[0]?.symbol?.endsWith('.KL')) return quotes[0].symbol;
  } catch (e) {
    console.error("Search API Error for", name, e);
  }
  return null;
}

async function fetchYahooCandles(symbol: string): Promise<YahooData | null> {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
  try {
    const res = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 TradeNetMY/1.0",
        "Accept": "application/json"
      }
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    const companyName = meta?.shortName || symbol;

    const quotes = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp || [];
    const opens = quotes?.open || [];
    const highs = quotes?.high || [];
    const lows = quotes?.low || [];
    const closes = quotes?.close || [];
    const volumes = quotes?.volume || [];

    const candles: Candle[] = [];
    for (let i = 0; i < closes.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
      if (o !== null && h !== null && l !== null && c !== null && v !== null &&
          o !== undefined && h !== undefined && l !== undefined && c !== undefined && v !== undefined) {
        candles.push({
          timestamp: timestamps[i],
          open: Number(o),
          high: Number(h),
          low: Number(l),
          close: Number(c),
          volume: Number(v)
        });
      }
    }

    const basePrice = candles.length > 0 ? candles[candles.length - 1].close : price;
    if (Number.isFinite(basePrice) && basePrice > 0 && candles.length > 0) {
      return { price: basePrice, companyName, symbol, candles };
    }
  } catch (err) {
    console.error(`Error fetching ${symbol}:`, err);
  }
  return null;
}

// Indicator helper functions
function calculateEMA(prices: number[], length: number): number[] {
  const ema: number[] = new Array(prices.length).fill(0);
  if (prices.length < length) return ema;

  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += prices[i];
  }
  let prevEma = sum / length;
  ema[length - 1] = prevEma;

  const multiplier = 2 / (length + 1);
  for (let i = length; i < prices.length; i++) {
    const currentEma = (prices[i] - prevEma) * multiplier + prevEma;
    ema[i] = currentEma;
    prevEma = currentEma;
  }
  return ema;
}

function calculateRSI(closes: number[], length: number = 13): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < length + 1) return rsi;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / length;
  let avgLoss = losses / length;

  for (let i = length + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (length - 1) + gain) / length;
    avgLoss = (avgLoss * (length - 1) + loss) / length;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsi;
}

function calculateSMA(data: number[], length: number): number[] {
  const sma: number[] = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    if (i < length - 1) {
      sma[i] = data[i];
      continue;
    }
    let sum = 0;
    for (let j = 0; j < length; j++) {
      sum += data[i - j];
    }
    sma[i] = sum / length;
  }
  return sma;
}

function calculateStochRSI(closes: number[], rsiLength: number = 13, stochLength: number = 14, kSmooth: number = 3, dSmooth: number = 3) {
  const rsi = calculateRSI(closes, rsiLength);
  const stochRaw: number[] = new Array(closes.length).fill(50);

  for (let i = 0; i < closes.length; i++) {
    if (i < rsiLength + stochLength) {
      stochRaw[i] = 50;
      continue;
    }
    const windowRsi = rsi.slice(i - stochLength + 1, i + 1);
    const minRsi = Math.min(...windowRsi);
    const maxRsi = Math.max(...windowRsi);
    if (maxRsi === minRsi) {
      stochRaw[i] = 50;
    } else {
      stochRaw[i] = ((rsi[i] - minRsi) / (maxRsi - minRsi)) * 100;
    }
  }

  const kLine = calculateSMA(stochRaw, kSmooth);
  const dLine = calculateSMA(kLine, dSmooth);

  return { kLine, dLine };
}

function extractStockSymbols(text: string): string[] {
  const rawTokens = text.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);

  // 1. Find 4-digit or 5-digit Bursa stock codes (e.g. 7204, 8907, 0270, 7155, 0459)
  let stockTokens = rawTokens.filter(t => /^\d{4,5}$/.test(t));

  // 2. If no numeric codes found (e.g. user pasted stock names like "MYEG YTL INARI NATGATE")
  if (stockTokens.length === 0) {
    stockTokens = rawTokens
      .map(t => t.replace(/\[S\]/gi, '').trim())
      .filter(clean => {
        if (clean.length < 2) return false;
        if (clean.includes('[') || clean.includes(']')) return false;
        if (clean.includes('.') || clean.includes(',')) return false;
        if (/^[\d+.-]+$/.test(clean)) return false; // Ignore decimal numbers/prices/percentages
        if (clean.toUpperCase() === 'CALL' || clean.toLowerCase() === 's') return false;
        return true;
      });
  }

  return Array.from(new Set(stockTokens)).slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let symbols: string[] = [];

    if (Array.isArray(body.tickers) && body.tickers.length > 0) {
      symbols = body.tickers;
    } else if (typeof body.text === 'string') {
      symbols = extractStockSymbols(body.text);
    }

    if (!symbols || symbols.length === 0) {
      return NextResponse.json({ success: false, error: 'Tiada kod/simbol saham yang sah dijumpai dalam teks.' }, { status: 400 });
    }

    const resolved = await Promise.all(symbols.map(s => resolveSymbol(s)));
    const validSymbols = resolved.filter((s): s is string => s !== null);

    const dataList = await Promise.all(validSymbols.map(s => fetchYahooCandles(s)));
    const validData = dataList.filter((d): d is YahooData => d !== null);

    const scannedResults = validData.map(data => {
      const candles = data.candles;
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const len = closes.length;

      if (len < 30) return null;

      const emaFast = calculateEMA(closes, 9);
      const emaSlow = calculateEMA(closes, 21);
      const emaTrend = calculateEMA(closes, 55);

      const rsi = calculateRSI(closes, 13);
      const { kLine, dLine } = calculateStochRSI(closes, 13, 14, 3, 3);

      const lastIdx = len - 1;
      const prevIdx = len - 2;

      const currClose = closes[lastIdx];
      const currEmaFast = emaFast[lastIdx];
      const currEmaSlow = emaSlow[lastIdx];
      const currEmaTrend = emaTrend[lastIdx];

      const prevEmaFast = emaFast[prevIdx];
      const prevEmaSlow = emaSlow[prevIdx];

      const currK = kLine[lastIdx];
      const currD = dLine[lastIdx];
      const prevK = kLine[prevIdx];
      const prevD = dLine[prevIdx];

      // Crossover calculations
      const emaCrossed = prevEmaFast <= prevEmaSlow && currEmaFast > currEmaSlow;
      const emaBullish = currEmaFast > currEmaSlow;

      const stochCrossed = prevK <= prevD && currK > currD;
      const stochBullish = currK > currD;

      // Volume average
      const recentVols = volumes.slice(Math.max(0, len - 21), len - 1);
      const avgVol = recentVols.reduce((a, b) => a + b, 0) / (recentVols.length || 1);
      const volAboveAvg = volumes[lastIdx] > avgVol * 1.1;

      // Confluence Score Calculation
      let score = 0;
      if (emaBullish) score += 1.5;
      if (emaCrossed) score += 1.5;
      if (currClose > currEmaTrend) score += 1.0;
      if (rsi[lastIdx] > 50 && rsi[lastIdx] < 75) score += 1.0;
      if (stochBullish) score += 1.0;
      if (stochCrossed) score += 1.5;
      if (currClose > currEmaFast) score += 1.0;
      if (volAboveAvg) score += 1.5;

      const grade = score >= 8.0 ? 'A+' : score >= 6.5 ? 'A' : score >= 5.0 ? 'B' : 'C';

      // Gann targets
      const gann = getStaticGannTargets(currClose);

      return {
        symbol: data.symbol,
        companyName: data.companyName,
        price: currClose,
        score: Number(score.toFixed(1)),
        grade,
        emaStatus: emaCrossed ? 'CROSS_UP' : emaBullish ? 'BULLISH' : 'BEARISH',
        stochStatus: stochCrossed ? 'CROSS_UP' : stochBullish ? 'BULLISH' : 'BEARISH',
        emaFast: Number(currEmaFast.toFixed(3)),
        emaSlow: Number(currEmaSlow.toFixed(3)),
        stochK: Number(currK.toFixed(1)),
        stochD: Number(currD.toFixed(1)),
        rsi: Number(rsi[lastIdx].toFixed(1)),
        stopLoss: gann.staticSL,
        tp1: gann.staticTP1,
        tp2: gann.staticTP2
      };
    }).filter(Boolean);

    // Sort by score descending
    scannedResults.sort((a: any, b: any) => b.score - a.score);

    return NextResponse.json({
      success: true,
      count: scannedResults.length,
      results: scannedResults
    });

  } catch (err: any) {
    console.error('Error in bursa-adaptive-sniper route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
