import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

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
  'OGX': '0327.KL'
};

async function resolveSymbol(symbol: string, name?: string): Promise<string | null> {
  const cleanSym = symbol.trim().toUpperCase();
  if (HARDCODED_MAPPING[cleanSym]) return HARDCODED_MAPPING[cleanSym];
  
  if (/^\d{4}$/.test(cleanSym)) return `${cleanSym}.KL`;

  // Try to search by company name first
  if (name && name.trim()) {
    try {
      const cleanName = name.trim().toUpperCase()
        .replace(/[-\s]+BHD/i, '')
        .replace(/[-\s]+BERHAD/i, '');
      const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanName)}&quotesCount=5&newsCount=0`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (res.ok) {
        const data: any = await res.json();
        const quotes = data.quotes || [];
        const klseStock = quotes.find((q: any) => q.exchange === 'KLS' || q.symbol.endsWith('.KL'));
        if (klseStock) return klseStock.symbol;
      }
    } catch (e) {
      console.warn("Failed to resolve via name search:", name, e);
    }
  }

  // Fallback to searching by symbol
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanSym)}&quotesCount=5&newsCount=0`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (res.ok) {
      const data: any = await res.json();
      const quotes = data.quotes || [];
      const klseStock = quotes.find((q: any) => q.exchange === 'KLS' || q.symbol.endsWith('.KL'));
      if (klseStock) return klseStock.symbol;
      if (quotes[0]?.symbol?.endsWith('.KL')) return quotes[0].symbol;
    }
  } catch (e) {
    console.error("Search API Error for symbol", cleanSym, e);
  }

  return null;
}

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
          if (Number(h) > currentWeekHighest) {
            currentWeekHighest = Number(h);
          }
        } else {
          candles.push({ timestamp: timestamps[i], open: Number(o), high: Number(h), low: Number(l), close: Number(c), volume: Number(v) });
        }
      }
    }

    const basePrice = candles.length > 0 ? candles[candles.length - 1].close : Number(meta?.regularMarketPrice);

    if (Number.isFinite(basePrice) && basePrice > 0 && candles.length > 0) {
      return { price: basePrice, companyName, symbol, candles, currentWeekHighest };
    }
  } catch (err) {
    console.error(`Error fetching ${symbol}:`, err);
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

// Calculate indicators and targets for manual stock (bypassing liquidity/trend filters)
async function calculateStockTargets(symbol: string, companyName?: string) {
  const resolved = await resolveSymbol(symbol, companyName);
  if (!resolved) return null;

  const data = await fetchYahooPrice(resolved);
  if (!data || data.candles.length < 15) return null;

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
  const idx = size - 1;
  const c = closes[idx];

  const e13 = emaFast[idx] || c;
  const e34 = emaSlow[idx] || c;
  const e89 = emaTrend[idx] || c;

  let score = 0;
  if (e13 > e34) score += 2;
  if (c > e89) score += 2;
  if (macd.histLine[idx] > 0) score += 1.5;
  if (macd.macdLine[idx] > macd.signalLine[idx]) score += 1.5;
  if (c > ((highs[idx] + lows[idx] + c) / 3)) score += 1;
  if (vols[idx] > (volSma[idx] || 0) * 1.5) score += 2;
  if (lows[idx] <= e13 && c > e13) score += 1.5;
  score = Math.min(10, score);

  const recentSwingLow = getSwingLow(lows, idx, Math.min(10, idx));
  const currentAtr = atrVal[idx] || (c * 0.05); 
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

  return {
    symbol: data.symbol,
    companyName: data.companyName,
    price: data.price.toFixed(3),
    score: score.toFixed(1),
    stopLoss: stopLoss.toFixed(3),
    tp1: tp1.toFixed(3),
    tp2: tp2.toFixed(3),
    tp3: tp3.toFixed(3),
    tp4: tp4.toFixed(3),
    highest: highest.toFixed(3)
  };
}

// Retrieve Custom Master List and calculate live prices
export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const { results } = await db.prepare(`
      SELECT * FROM custom_picks 
      ORDER BY score DESC
    `).all();

    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, data: [], lastUpdated: null });
    }

    const lastUpdated = results[0].date || null;
    const symbols = results.map((r: any) => r.symbol);
    
    const quotePromises = symbols.map(async (sym: string) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`, {
          headers: {
            "User-Agent": "Mozilla/5.0 TradeNetMY/1.0",
            "Accept": "application/json"
          },
          cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        const result = data?.chart?.result?.[0];
        if (result?.meta) {
          const timestamps = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const highs = result.indicators?.quote?.[0]?.high || [];
          
          const currentLivePrice = result.meta.regularMarketPrice;
          const currentHigh = result.meta.regularMarketDayHigh;

          const now = new Date();
          const myTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
          const currentDay = myTime.getDay();
          const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
          const mondayStart = new Date(myTime);
          mondayStart.setDate(myTime.getDate() - daysSinceMonday);
          mondayStart.setHours(0, 0, 0, 0);
          const mondayStartMs = mondayStart.getTime();

          let lastWeekClose = currentLivePrice;
          let lastWeekDateStr = '';
          let currentWeekHighest = currentHigh;

          for (let i = timestamps.length - 1; i >= 0; i--) {
            const ts = timestamps[i] * 1000;
            if (ts >= mondayStartMs) {
              if (highs[i] && highs[i] > currentWeekHighest) {
                currentWeekHighest = highs[i];
              }
            } else {
              if (closes[i]) {
                lastWeekClose = closes[i];
                const dateObj = new Date(ts);
                lastWeekDateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              }
              break;
            }
          }

          return { 
            symbol: sym, 
            lastWeekClose,
            lastWeekDateStr,
            currentLivePrice,
            currentHigh: currentWeekHighest
          };
        }
      } catch (err) {
        console.warn(`Failed to fetch live price for ${sym}`, err);
      }
      return null;
    });

    const quoteResults = await Promise.all(quotePromises);
    const quoteMap: Record<string, any> = {};
    for (const res of quoteResults) {
      if (res) {
        quoteMap[res.symbol] = {
          lastWeekClose: res.lastWeekClose,
          lastWeekDateStr: res.lastWeekDateStr,
          currentLivePrice: res.currentLivePrice,
          currentHigh: res.currentHigh
        };
      }
    }

    const enrichedResults = results.map((row: any) => {
      const q = quoteMap[row.symbol];
      const basePrice = q?.lastWeekClose || row.price;
      const currentLivePrice = q?.currentLivePrice || row.price;
      const currentHigh = q?.currentHigh || currentLivePrice;
      
      return {
        symbol: row.symbol,
        companyName: row.company_name,
        price: basePrice.toFixed(3),
        currentPrice: currentLivePrice.toFixed(3),
        lastDoneDate: q?.lastWeekDateStr || '',
        score: row.score.toFixed(1),
        stopLoss: row.stop_loss.toFixed(3),
        tp1: row.tp1.toFixed(3),
        tp2: row.tp2.toFixed(3),
        tp3: row.tp3.toFixed(3),
        tp4: row.tp4.toFixed(3),
        highestPrice: currentHigh.toFixed(3),
        
        staticSL: getStaticGannTargets(basePrice).staticSL,
        staticSLColor: getStaticGannTargets(basePrice).staticSLColor,
        staticTP1: getStaticGannTargets(basePrice).staticTP1,
        staticTP1Color: getStaticGannTargets(basePrice).staticTP1Color,
        staticTP2: getStaticGannTargets(basePrice).staticTP2,
        staticTP2Color: getStaticGannTargets(basePrice).staticTP2Color,
        staticTP3: getStaticGannTargets(basePrice).staticTP3,
        staticTP3Color: getStaticGannTargets(basePrice).staticTP3Color,
        staticTP4: getStaticGannTargets(basePrice).staticTP4,
        staticTP4Color: getStaticGannTargets(basePrice).staticTP4Color,

        hitTp1: currentHigh >= row.tp1,
        hitTp2: currentHigh >= row.tp2,
        hitTp3: currentHigh >= row.tp3,
        hitTp4: currentHigh >= row.tp4,
      };
    });

    return NextResponse.json({ success: true, data: enrichedResults, lastUpdated });

  } catch (error: any) {
    console.error("[Bursa Custom Picks] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch custom picks" }, { status: 500 });
  }
}

// Save Custom Scan results to Master List OR Add a single stock
export async function POST(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { action, symbol, name, results } = body;
    const timestamp = new Date().toISOString();

    // 1. ADD SINGLE STOCK ACTION
    if (action === 'add' && symbol) {
      const cleanSym = symbol.trim().toUpperCase();
      
      // Resolve & calculate targets using symbol AND company name
      const calculated = await calculateStockTargets(cleanSym, name);
      if (!calculated) {
        return NextResponse.json({ success: false, error: `Gagal menganalisis kaunter ${cleanSym}. Sila pastikan kod betul.` }, { status: 400 });
      }

      // Check duplicates with resolved symbol
      const existing = await db.prepare('SELECT id FROM custom_picks WHERE symbol = ? OR id = ?').bind(calculated.symbol, calculated.symbol).first();
      if (existing) {
        return NextResponse.json({ success: false, error: `Kaunter ${calculated.symbol} sudah berada di dalam Watchlist.` }, { status: 400 });
      }

      // Save to D1 database
      await db.prepare(`
        INSERT INTO custom_picks (id, date, symbol, company_name, price, score, stop_loss, tp1, tp2, tp3, tp4, highest_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        calculated.symbol,
        timestamp,
        calculated.symbol,
        calculated.companyName,
        parseFloat(calculated.price),
        parseFloat(calculated.score),
        parseFloat(calculated.stopLoss),
        parseFloat(calculated.tp1),
        parseFloat(calculated.tp2),
        parseFloat(calculated.tp3),
        parseFloat(calculated.tp4),
        parseFloat(calculated.highest)
      ).run();

      console.log(`[Bursa Custom Picks] Manually added ${calculated.symbol} to database`);
      return NextResponse.json({ success: true, symbol: calculated.symbol, companyName: calculated.companyName });
    }

    // 2. BULK SAVE ACTION (OCR Scanner/Custom list save)
    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    // Clear old custom list
    await db.prepare('DELETE FROM custom_picks').run();
    
    const stmt = db.prepare(`
      INSERT INTO custom_picks (id, date, symbol, company_name, price, score, stop_loss, tp1, tp2, tp3, tp4, highest_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = results.map((pick: any) => {
      return stmt.bind(
        pick.symbol,
        timestamp,
        pick.symbol,
        pick.companyName || pick.originalName || pick.symbol,
        parseFloat(pick.price),
        parseFloat(pick.score),
        parseFloat(pick.stopLoss),
        parseFloat(pick.tp1),
        parseFloat(pick.tp2),
        parseFloat(pick.tp3),
        pick.tp4 ? parseFloat(pick.tp4) : 0,
        parseFloat(pick.highestPrice || pick.price)
      );
    });

    if (batch.length > 0) {
      await db.batch(batch);
      console.log(`[Bursa Custom Picks] Saved ${batch.length} picks to D1 at ${timestamp}`);
    }

    return NextResponse.json({ success: true, count: batch.length });

  } catch (error: any) {
    console.error("[Bursa Custom Picks POST] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save custom picks" }, { status: 500 });
  }
}
