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
  currentWeekHighest?: number;
}

// Map some known names just in case search fails or is ambiguous
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
  'SUM': '0209.KL',
  'OPPSTAR': '0275.KL',
  'EIPOWER': '0228.KL',
  'NE': '0325.KL',
  'MCLEAN': '0167.KL',
  'ICENTS': '0200.KL',
  'CPETECH': '5317.KL',
  'OGX': '0327.KL',
  'MNHLDG': '0245.KL',
  'MNRB': '6459.KL'
};

async function resolveSymbol(name: string): Promise<string | null> {
  let query = name.trim().toUpperCase();
  if (HARDCODED_MAPPING[query]) return HARDCODED_MAPPING[query];
  
  if (/^\d{4}$/.test(query)) return `${query}.KL`;

  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const quotes = data.quotes || [];
    
    // Find the first KLSE stock
    const klseStock = quotes.find((q: any) => q.exchange === 'KLS' || q.symbol.endsWith('.KL'));
    if (klseStock) {
      return klseStock.symbol;
    }
    
    // fallback to first if it has KL
    if (quotes[0]?.symbol?.endsWith('.KL')) return quotes[0].symbol;
  } catch (e) {
    console.error("Search API Error for", name, e);
  }
  return null;
}

async function fetchYahooPrice(symbol: string): Promise<YahooData | null> {
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
    
    const now = new Date();
    const myTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const currentDay = myTime.getDay();
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
    const mondayStart = new Date(myTime);
    mondayStart.setDate(myTime.getDate() - daysSinceMonday);
    mondayStart.setHours(0, 0, 0, 0);
    const mondayStartMs = mondayStart.getTime();

    let currentWeekHighest = 0;

    for (let i = 0; i < closes.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
      const ts = timestamps[i] * 1000;
      
      if (o !== null && h !== null && l !== null && c !== null && v !== null &&
          o !== undefined && h !== undefined && l !== undefined && c !== undefined && v !== undefined) {
        
        if (ts >= mondayStartMs) {
          // Track highest price for current week but DO NOT add to candles (simulate Friday)
          if (Number(h) > currentWeekHighest) {
            currentWeekHighest = Number(h);
          }
        } else {
          candles.push({ timestamp: timestamps[i], open: Number(o), high: Number(h), low: Number(l), close: Number(c), volume: Number(v) });
        }
      }
    }

    // Set price to the last candle's close (which should be Friday)
    const basePrice = candles.length > 0 ? candles[candles.length - 1].close : Number(meta?.regularMarketPrice);

    if (Number.isFinite(basePrice) && basePrice > 0 && candles.length > 0) {
      return { price: basePrice, companyName, symbol, candles, currentWeekHighest };
    }
  } catch (err) {
    console.error(`Error fetching ${symbol}:`, err);
  }
  return null;
}

// Indicator Functions
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

function calculateMACD(prices: number[]): { macdLine: number[], signalLine: number[], histLine: number[] } {
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

function calculateATR(highs: number[], lows: number[], closes: number[], length: number): number[] {
  const atr: number[] = [];
  if (closes.length <= length) return atr;
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i], l = lows[i], pc = closes[i - 1];
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let trSum = 0;
  for (let i = 0; i < length; i++) trSum += tr[i];
  let currentAtr = trSum / length;
  atr[length - 1] = currentAtr;
  for (let i = length; i < closes.length; i++) {
    currentAtr = (currentAtr * (length - 1) + tr[i]) / length;
    atr[i] = currentAtr;
  }
  return atr;
}

function getSwingLow(lows: number[], index: number, lookback: number): number {
  let swLow = lows[index];
  for (let i = 1; i <= lookback; i++) {
    const idx = index - i;
    if (idx >= 0 && lows[idx] < swLow) swLow = lows[idx];
  }
  return swLow;
}

async function processBursaStock(originalName: string) {
  const symbol = await resolveSymbol(originalName);
  if (!symbol) return null;

  const data = await fetchYahooPrice(symbol);
  if (!data || data.candles.length < 50) return null;
  if (data.price < 0.20 || data.price > 3.00) return null;

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
  const atrVal = calculateATR(highs, lows, closes, 20);

  const size = candles.length;
  const idx = size - 1; // Latest candle

  const c = closes[idx];
  
  const avgVolume = volSma[idx] || 0;
  const avgTradedValue = avgVolume * c;
  
  // Liquidity Filter 1: Reject if average daily traded value is less than RM 500,000
  if (avgTradedValue < 500000) return null;
  
  // Liquidity Filter 2 (Barcode Chart Trap): Reject if price doesn't move. 
  // Count how many of the last 10 candles are basically flat (range <= 1 tick)
  let flatCandles = 0;
  for (let i = Math.max(0, size - 10); i <= idx; i++) {
    if (highs[i] - lows[i] <= 0.0051) {
      flatCandles++;
    }
  }
  // If 4 or more out of the last 10 days are flat, it's a barcode chart. Reject.
  if (flatCandles >= 4) return null;

  const e13 = emaFast[idx];
  const e34 = emaSlow[idx];
  const e89 = emaTrend[idx];

  let score = 0;
  
  // Trend
  if (e13 > e34) score += 2;
  if (c > e89) score += 2;
  
  // Momentum
  if (macd.histLine[idx] > 0) score += 1.5;
  if (macd.macdLine[idx] > macd.signalLine[idx]) score += 1.5;
  
  // Price Action
  if (c > ((highs[idx] + lows[idx] + c) / 3)) score += 1;
  
  // Volume Spike (Bursa often responds well to volume)
  if (vols[idx] > (volSma[idx] || 0) * 1.5) score += 2;

  // Recent Pullback Bounce (Highly rated)
  const isPullback = lows[idx] <= e13 && c > e13;
  if (isPullback) score += 1.5;

  // Max score ~11.5, let's cap at 10.
  score = Math.min(10, score);

  // Stop Loss & Take Profit logic
  const recentSwingLow = getSwingLow(lows, idx, 10);
  const currentAtr = atrVal[idx] || (c * 0.05); 
  
  // Stop loss below swing low or 1.5 ATR
  const sl1 = recentSwingLow - (currentAtr * 0.2);
  const sl2 = c - (currentAtr * 1.5);
  const stopLoss = Math.min(sl1, sl2);
  const risk = Math.max(0.01, c - stopLoss);
  
  const tp1 = c + (risk * 1.5);
  const tp2 = c + (risk * 2.5);
  const tp3 = c + (risk * 3.5);
  const tp4 = c + (risk * 4.5);
  
  const last5Highs = highs.slice(-5);
  const highest = (data.currentWeekHighest ?? 0) > 0 ? data.currentWeekHighest! : Math.max(...last5Highs);

  // Only consider stocks above EMA 34 as healthy candidates
  if (c < e34) return null;

  const gann = getStaticGannTargets(c, 100);

  return {
    originalName,
    symbol: data.symbol,
    companyName: data.companyName,
    price: data.price.toFixed(3), // Bursa format usually 3 decimals
    score: score.toFixed(1),
    stopLoss: stopLoss.toFixed(3),
    tp1: tp1.toFixed(3),
    tp2: tp2.toFixed(3),
    tp3: tp3.toFixed(3),
    tp4: tp4.toFixed(3),
    highest: highest.toFixed(3),
    risk: risk.toFixed(3),
    gannSL: gann.staticSL,
    gannSLColor: gann.staticSLColor,
    gannTP1: gann.staticTP1,
    gannTP1Color: gann.staticTP1Color,
    gannTP2: gann.staticTP2,
    gannTP2Color: gann.staticTP2Color,
    gannTP3: gann.staticTP3,
    gannTP3Color: gann.staticTP3Color,
    gannTP4: gann.staticTP4,
    gannTP4Color: gann.staticTP4Color,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stocks: string[] = body.stocks || [];
    
    if (stocks.length === 0) {
      return NextResponse.json({ error: "No stocks provided" }, { status: 400 });
    }

    console.log(`[Bursa Sniper] Scanning ${stocks.length} stocks...`);

    const batchSize = 20;
    const results = [];
    
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const batchPromises = batch.map(s => processBursaStock(s));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
    }
    
    const validResults = results as any[];
    
    // Sort descending by score
    validResults.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    // Return only top 20 highest scoring and potential counters
    const top20 = validResults.slice(0, 20);

    return NextResponse.json({ success: true, data: top20 });

  } catch (e: any) {
    console.error("[Bursa Sniper] API Error:", e);
    return NextResponse.json({ error: e.message || "Failed to scan" }, { status: 500 });
  }
}
