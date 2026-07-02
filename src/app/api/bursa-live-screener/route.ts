import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

const BURSA_MASTER_SYMBOLS = [
  '0166.KL', '0128.KL', '0251.KL', '0104.KL', '0209.KL', '0275.KL', '0228.KL', '0325.KL',
  '0167.KL', '0200.KL', '5317.KL', '0327.KL', '0097.KL', '0271.KL', '5301.KL', '0151.KL',
  '0221.KL', '0128.KL', '7022.KL', '5216.KL', '0138.KL', '7164.KL', '5286.KL', '3867.KL',
  '5005.KL', '0208.KL', '7160.KL', '5292.KL', '5148.KL', '8664.KL', '5131.KL', '3336.KL',
  '8206.KL', '8583.KL', '5236.KL', '5827.KL', '5053.KL', '5398.KL', '5211.KL', '5288.KL',
  '9571.KL', '8966.KL', '4677.KL', '6742.KL', '5347.KL', '5184.KL', '5210.KL', '7277.KL',
  '6033.KL', '7192.KL', '5120.KL', '0225.KL', '4707.KL', '5296.KL', '5225.KL', '5819.KL',
  '7153.KL', '5168.KL', '7113.KL', '7106.KL', '0163.KL', '1155.KL', '1023.KL', '1295.KL',
  '0366.KL',
  '1015.KL', '1082.KL', '1066.KL', '5258.KL', '6888.KL', '6012.KL', '4863.KL', '5031.KL',
  '5204.KL', '0233.KL', '0223.KL', '0246.KL', '7100.KL', '0219.KL', '7204.KL', '0212.KL'
];

// Deduplicate just in case
const MASTER_LIST = Array.from(new Set(BURSA_MASTER_SYMBOLS));

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
    let companyName = meta?.shortName || symbol;
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
      return { price, companyName, symbol, candles };
    }
  } catch (err) {
    // console.error(`Error fetching ${symbol}:`, err);
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

async function processBursaStock(symbol: string) {
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

  score = Math.min(10, score);

  // Stop Loss & Take Profit logic using Gann Square of Nine
  const s = Math.sqrt(c * 100);
  const stopLoss = (Math.pow((s - 0.50) / 10, 2)).toFixed(3);
  const tp1 = (Math.pow((s + 0.25) / 10, 2)).toFixed(3);
  const tp2 = (Math.pow((s + 0.50) / 10, 2)).toFixed(3);
  const tp3 = (Math.pow((s + 0.75) / 10, 2)).toFixed(3);
  const tp4 = (Math.pow((s + 1.00) / 10, 2)).toFixed(3);

  const staticTargets = getStaticGannTargets(c);

  // Highest price in last 5 days
  let highestPrice = 0;
  for (let i = Math.max(0, size - 5); i < size; i++) {
    if (highs[i] > highestPrice) highestPrice = highs[i];
  }

  // Strictly filter out stocks below EMA 34 (Must be in a healthy trend for a 5-day swing)
  if (c < e34) return null;
  
  // Filter out weak stocks (Score must be at least 4.0 for a quality sniper pick)
  if (score < 4.0) return null;

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
    highestPrice: highestPrice.toFixed(3)
  };
}

export async function GET(req: NextRequest) {
  try {
    console.log(`[Bursa Live Screener] Scanning ${MASTER_LIST.length} stocks...`);

    // Fetch in batches of 20 to avoid overwhelming connections
    const batchSize = 20;
    const results = [];
    
    for (let i = 0; i < MASTER_LIST.length; i += batchSize) {
      const batch = MASTER_LIST.slice(i, i + batchSize);
      const batchPromises = batch.map(s => processBursaStock(s));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
    }
    
    const validResults = results as any[];
    
    // Sort descending by score
    validResults.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    const top30 = validResults.slice(0, 30);
    
    const saveToMaster = req.nextUrl.searchParams.get('save') === 'true';

    // Save to D1 Database if requested
    if (saveToMaster) {
      try {
        const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
        if (db) {
          const timestamp = new Date().toISOString();
          
          // Clear old master list before saving new one
          await db.prepare('DELETE FROM daily_picks').run();
          
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_picks (id, date, symbol, company_name, price, score, stop_loss, tp1, tp2, tp3, tp4, highest_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

        const batch = top30.map(pick => {
          return stmt.bind(
            pick.symbol,
            timestamp,
            pick.symbol,
            pick.companyName,
            pick.price,
            pick.score,
            pick.stopLoss,
            pick.tp1,
            pick.tp2,
            pick.tp3,
            pick.tp4,
            pick.highestPrice
          );
        });

          if (batch.length > 0) {
            await db.batch(batch);
            console.log(`[Bursa Live Screener] Saved ${batch.length} picks to D1 as Master List at ${timestamp}`);
          }
        }
      } catch (e: any) {
        console.error('[Bursa Live Screener] D1 Error:', e);
      }
    }

    return NextResponse.json({ success: true, data: top30 });

  } catch (e: any) {
    console.error("[Bursa Live Screener] API Error:", e);
    return NextResponse.json({ error: e.message || "Failed to scan" }, { status: 500 });
  }
}
