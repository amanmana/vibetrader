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

async function searchYahooSymbol(query: string): Promise<string | null> {
  // If the user already typed a .KL symbol
  if (query.toUpperCase().endsWith('.KL')) return query.toUpperCase();

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const quotes = data.quotes || [];
    if (quotes.length > 0) {
      // Prioritize Malaysian stocks (.KL)
      const klStock = quotes.find((q: any) => q.symbol.endsWith('.KL'));
      if (klStock) return klStock.symbol;
      // If we typed "5253" and the first result is "5253.KL" it'll be caught above.
      // If it's a generic stock, return the first symbol just in case.
      return quotes[0].symbol;
    }
  } catch(e) {
    console.error("Search error:", e);
  }
  return null;
}

async function fetchYahooPrice(symbol: string): Promise<YahooData | null> {
  // Append .KL if it's purely numbers and doesn't have it
  let finalSymbol = symbol;
  if (/^\d+$/.test(finalSymbol)) {
    finalSymbol = `${finalSymbol}.KL`;
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(finalSymbol)}?interval=1d&range=6mo`;
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
    let companyName = meta?.shortName || finalSymbol;
    companyName = companyName.replace(/\.KL$/, '');

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
        candles.push({ timestamp: timestamps[i], open: Number(o), high: Number(h), low: Number(l), close: Number(c), volume: Number(v) });
      }
    }

    if (Number.isFinite(price) && price > 0 && candles.length > 0) {
      return { price, companyName, symbol: finalSymbol, candles };
    }
  } catch (err) {
    // ignore
  }
  return null;
}

function calculateEMA(prices: number[], length: number): number[] {
  const ema: number[] = [];
  if (prices.length === 0) return ema;
  const k = 2 / (length + 1);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += prices[i];
  let currentEma = sum / length;
  ema[length - 1] = currentEma;
  for (let i = length; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    ema[i] = currentEma;
  }
  return ema;
}

function calculateSMA(values: number[], length: number): number[] {
  const sma: number[] = [];
  if (values.length < length) return sma;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += values[i];
  sma[length - 1] = sum / length;
  for (let i = length; i < values.length; i++) {
    sum = sum - values[i - length] + values[i];
    sma[i] = sum / length;
  }
  return sma;
}

function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (ema12[i] !== undefined && ema26[i] !== undefined) {
      macdLine[i] = ema12[i] - ema26[i];
    }
  }
  const firstValidIndex = macdLine.findIndex(v => v !== undefined);
  const validMacd = macdLine.slice(firstValidIndex);
  const validSignal = calculateEMA(validMacd, 9);
  
  const signalLine: number[] = [];
  const histLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < firstValidIndex + 8) {
      signalLine[i] = 0;
      histLine[i] = 0;
    } else {
      const sigVal = validSignal[i - firstValidIndex];
      signalLine[i] = sigVal;
      histLine[i] = macdLine[i] - sigVal;
    }
  }
  return { macdLine, signalLine, histLine };
}

async function processSearchStock(query: string) {
  const resolvedSymbol = await searchYahooSymbol(query);
  if (!resolvedSymbol) return null;

  const data = await fetchYahooPrice(resolvedSymbol);
  if (!data || data.candles.length < 50) return null;

  const candles = data.candles;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const vols = candles.map(c => c.volume);

  const emaFast = calculateEMA(closes, 13);
  const emaSlow = calculateEMA(closes, 34);
  const emaTrend = calculateEMA(closes, 89);
  const macd = calculateMACD(closes);
  const volSma = calculateSMA(vols, 20);

  const size = candles.length;
  const idx = size - 1;

  const c = closes[idx];
  const e13 = emaFast[idx];
  const e34 = emaSlow[idx];
  const e89 = emaTrend[idx];

  let score = 0;
  
  if (e13 > e34) score += 2;
  if (c > e89) score += 2;
  if (macd.histLine[idx] > 0) score += 1.5;
  if (macd.macdLine[idx] > macd.signalLine[idx]) score += 1.5;
  if (c > ((highs[idx] + lows[idx] + c) / 3)) score += 1;
  if (vols[idx] > (volSma[idx] || 0) * 1.5) score += 2;
  const isPullback = lows[idx] <= e13 && c > e13;
  if (isPullback) score += 1.5;

  score = Math.min(10, score);

  // Dynamic Gann targets
  const s = Math.sqrt(c * 100);
  const stopLoss = (Math.pow((s - 0.50) / 10, 2)).toFixed(3);
  const tp1 = (Math.pow((s + 0.25) / 10, 2)).toFixed(3);
  const tp2 = (Math.pow((s + 0.50) / 10, 2)).toFixed(3);
  const tp3 = (Math.pow((s + 0.75) / 10, 2)).toFixed(3);
  const tp4 = (Math.pow((s + 1.00) / 10, 2)).toFixed(3);

  const staticTargets = getStaticGannTargets(c);

  let highestPrice = 0;
  for (let i = Math.max(0, size - 5); i < size; i++) {
    if (highs[i] > highestPrice) highestPrice = highs[i];
  }

  // WE DO NOT FILTER HERE. Always return the stock.
  
  return {
    symbol: data.symbol,
    companyName: data.companyName,
    price: data.price.toFixed(3),
    score: score.toFixed(1),
    stopLoss,
    tp1,
    tp2,
    tp3,
    tp4,
    staticSL: staticTargets.staticSL,
    staticSLColor: staticTargets.staticSLColor,
    staticTP1: staticTargets.staticTP1,
    staticTP1Color: staticTargets.staticTP1Color,
    staticTP2: staticTargets.staticTP2,
    staticTP2Color: staticTargets.staticTP2Color,
    staticTP3: staticTargets.staticTP3,
    staticTP3Color: staticTargets.staticTP3Color,
    staticTP4: staticTargets.staticTP4,
    staticTP4Color: staticTargets.staticTP4Color,
    highestPrice: highestPrice.toFixed(3),
    hitTp1: highestPrice >= parseFloat(tp1),
    hitTp2: highestPrice >= parseFloat(tp2),
    hitTp3: highestPrice >= parseFloat(tp3),
    hitTp4: highestPrice >= parseFloat(tp4)
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const result = await processSearchStock(query);

    if (!result) {
      return NextResponse.json({ error: 'Stock not found or insufficient data' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error searching stock' }, { status: 500 });
  }
}
