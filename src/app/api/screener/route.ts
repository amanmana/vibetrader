import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

// Mappings for Bursa Malaysia stock symbols to Yahoo Finance symbols
const BURSA_MAPPING: Record<string, string> = {
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
};

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
  currency: string;
  candles: Candle[];
}

async function fetchYahooPrice(ticker: string): Promise<YahooData | null> {
  let yahooSymbol = ticker.trim().toUpperCase();

  if (BURSA_MAPPING[yahooSymbol]) {
    yahooSymbol = BURSA_MAPPING[yahooSymbol];
  } else if (/^\d{4}$/.test(yahooSymbol)) {
    yahooSymbol = `${yahooSymbol}.KL`;
  }

  // Fetch 6 months of historical daily candles
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=6mo`;

  try {
    const res = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 TradeNetMY/1.0",
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      console.warn(`[Yahoo Finance] Failed to fetch for ${yahooSymbol}: ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    const companyName = meta?.shortName || ticker;
    const currency = meta?.currency || 'USD';

    const quotes = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp || [];
    const opens = quotes?.open || [];
    const highs = quotes?.high || [];
    const lows = quotes?.low || [];
    const closes = quotes?.close || [];
    const volumes = quotes?.volume || [];

    const candles: Candle[] = [];
    for (let i = 0; i < closes.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      const v = volumes[i];

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

    if (Number.isFinite(price) && price > 0 && candles.length > 0) {
      return { price, companyName, currency, candles };
    }
  } catch (err: any) {
    console.error(`[Yahoo Finance] Error fetching ${yahooSymbol}:`, err?.message || err);
  }
  return null;
}

// Technical indicator math functions
function calculateEMA(prices: number[], length: number): number[] {
  const ema: number[] = [];
  if (prices.length === 0) return ema;
  const k = 2 / (length + 1);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += prices[i];
  }
  let currentEma = sum / length;
  ema[length - 1] = currentEma;
  for (let i = length; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    ema[i] = currentEma;
  }
  return ema;
}

function calculateRSI(prices: number[], length: number): number[] {
  const rsi: number[] = [];
  if (prices.length <= length) return rsi;
  
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / length;
  let avgLoss = losses / length;
  rsi[length] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  for (let i = length + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    
    avgGain = (avgGain * (length - 1) + gain) / length;
    avgLoss = (avgLoss * (length - 1) + loss) / length;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calculateATR(highs: number[], lows: number[], closes: number[], length: number): number[] {
  const atr: number[] = [];
  if (closes.length <= length) return atr;
  
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    const trVal = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    tr.push(trVal);
  }
  
  let trSum = 0;
  for (let i = 0; i < length; i++) {
    trSum += tr[i];
  }
  let currentAtr = trSum / length;
  atr[length - 1] = currentAtr;
  
  for (let i = length; i < closes.length; i++) {
    currentAtr = (currentAtr * (length - 1) + tr[i]) / length;
    atr[i] = currentAtr;
  }
  return atr;
}

// Simple Moving Average
function calculateSMA(values: number[], length: number): number[] {
  const sma: number[] = [];
  if (values.length < length) return sma;
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += values[i];
  }
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

function calculateDMI(highs: number[], lows: number[], closes: number[], length: number): { diPlus: number[], diMinus: number[], adx: number[] } {
  const diPlus: number[] = [];
  const diMinus: number[] = [];
  const adx: number[] = [];
  const size = closes.length;
  if (size <= length) return { diPlus, diMinus, adx };
  
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [highs[0] - lows[0]];
  
  for (let i = 1; i < size; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  
  const rma = (values: number[], len: number) => {
    const res: number[] = [];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += values[i];
    let curr = sum / len;
    res[len - 1] = curr;
    for (let i = len; i < values.length; i++) {
      curr = (values[i] + curr * (len - 1)) / len;
      res[i] = curr;
    }
    return res;
  };
  
  const rmaPlusDM = rma(plusDM, length);
  const rmaMinusDM = rma(minusDM, length);
  const rmaTR = rma(tr, length);
  
  const dx: number[] = [];
  for (let i = 0; i < size; i++) {
    if (i < length - 1) {
      diPlus[i] = 0;
      diMinus[i] = 0;
      dx[i] = 0;
    } else {
      const trVal = rmaTR[i] === 0 ? 1 : rmaTR[i];
      diPlus[i] = (100 * rmaPlusDM[i]) / trVal;
      diMinus[i] = (100 * rmaMinusDM[i]) / trVal;
      const sum = diPlus[i] + diMinus[i];
      const diff = Math.abs(diPlus[i] - diMinus[i]);
      dx[i] = sum === 0 ? 0 : (100 * diff) / sum;
    }
  }
  
  const rmaDX = rma(dx, length);
  for (let i = 0; i < size; i++) {
    adx[i] = i < length * 2 - 2 ? 0 : rmaDX[i];
  }
  
  return { diPlus, diMinus, adx };
}

function getSwingLow(lows: number[], index: number, lookback: number): number {
  let swLow = lows[index];
  for (let i = 1; i <= lookback; i++) {
    const idx = index - i;
    if (idx >= 0 && lows[idx] < swLow) {
      swLow = lows[idx];
    }
  }
  return swLow;
}

function getSwingHigh(highs: number[], index: number, lookback: number): number {
  let swHigh = highs[index];
  for (let i = 1; i <= lookback; i++) {
    const idx = index - i;
    if (idx >= 0 && highs[idx] > swHigh) {
      swHigh = highs[idx];
    }
  }
  return swHigh;
}

function calcSL(isLong: boolean, entry: number, atrSL: number, atrVal: number, recentSwingLow: number, recentSwingHigh: number): number {
  const atrStop = isLong ? entry - atrSL : entry + atrSL;
  const structStop = isLong ? recentSwingLow - atrVal * 0.2 : recentSwingHigh + atrVal * 0.2;
  let finalStop = isLong ? Math.max(atrStop, structStop) : Math.min(atrStop, structStop);
  const minDist = atrVal * 0.5;
  const dist = Math.abs(entry - finalStop);
  if (dist < minDist) {
    finalStop = isLong ? entry - minDist : entry + minDist;
  }
  return finalStop;
}


async function processTicker(cleanTicker: string, category: string = '') {
  try {
    const yahooData = await fetchYahooPrice(cleanTicker);
    if (!yahooData) return null;

    const livePrice = yahooData.price;
    const candles = yahooData.candles;
    if(candles.length < 50) return null; // Not enough data

    const isBursa = cleanTicker.endsWith('.KL') || cleanTicker.endsWith('.MY') || BURSA_MAPPING[cleanTicker] !== undefined || /^\d{4}$/.test(cleanTicker);
    const marketProfile = isBursa ? 'Bursa' : 'US';

    const closeArr = candles.map(c => c.close);
    const highArr = candles.map(c => c.high);
    const lowArr = candles.map(c => c.low);
    const openArr = candles.map(c => c.open);
    const volArr = candles.map(c => c.volume);

    const emaFast = calculateEMA(closeArr, 13);
    const emaSlow = calculateEMA(closeArr, 34);
    const emaTrend = calculateEMA(closeArr, 89);
    const atrVal = calculateATR(highArr, lowArr, closeArr, 20);
    const rsiVal = calculateRSI(closeArr, 21);
    const volSma = calculateSMA(volArr, 20);
    const dmi = calculateDMI(highArr, lowArr, closeArr, 14);
    const macd = calculateMACD(closeArr);

    const size = candles.length;
    const WARMUP = Math.min(89, size - 1);

    const minScore = isBursa ? 6.5 : 5.0;
    const volMult = isBursa ? 1.00 : 1.20;
    const requireHTF = isBursa;
    const requireADX = isBursa;

    let lastDirection = 0;
    let activeTrade: any = null;
    let entryBarIndex = -1;
    let totalTrades = 0;
    let winningTrades = 0;

    for (let i = WARMUP; i < size; i++) {
      let bullScore = 0.0;
      bullScore += emaFast[i] > emaSlow[i] ? 1.0 : 0.0;
      bullScore += closeArr[i] > emaTrend[i] ? 1.0 : 0.0;
      bullScore += rsiVal[i] > 50 && rsiVal[i] < 75 ? 1.0 : 0.0;
      bullScore += macd.histLine[i] > 0 ? 1.0 : 0.0;
      bullScore += macd.macdLine[i] > macd.signalLine[i] ? 1.0 : 0.0;
      bullScore += closeArr[i] > ((highArr[i] + lowArr[i] + closeArr[i]) / 3) ? 1.0 : 0.0;
      const volAbove = volArr[i] > volSma[i] * volMult;
      bullScore += volAbove ? 1.0 : 0.0;
      const strongTrend = dmi.adx[i] > 20;
      bullScore += strongTrend && dmi.diPlus[i] > dmi.diMinus[i] ? 1.0 : 0.0;
      const htfBias = emaFast[i] > emaSlow[i] ? 1 : emaFast[i] < emaSlow[i] ? -1 : 0;
      bullScore += htfBias === 1 ? 1.5 : 0.0;
      bullScore += closeArr[i] > emaFast[i] ? 0.5 : 0.0;

      const emaBullCross = emaFast[i] > emaSlow[i] && emaFast[i - 1] <= emaSlow[i - 1];
      const longPullbackZone = lowArr[i] <= emaFast[i] || lowArr[i] <= emaSlow[i];
      const longPullbackBounce = longPullbackZone && closeArr[i] > emaFast[i] && closeArr[i] > emaSlow[i] && closeArr[i] > openArr[i];
      const breakoutHigh = Math.max(...highArr.slice(Math.max(0, i - 5), i));
      const longBreakout = closeArr[i] > breakoutHigh && closeArr[i] > emaFast[i] && closeArr[i] > emaSlow[i] && closeArr[i] > emaTrend[i] && volAbove;

      const longTrigger = isBursa ? longPullbackBounce : (emaBullCross || longPullbackBounce || longBreakout);
      const passesGrade = bullScore >= 5.0;
      const bullHTFOk = requireHTF ? htfBias === 1 : true;
      const bullADXOk = requireADX ? (strongTrend && dmi.diPlus[i] > dmi.diMinus[i]) : true;
      const rawBuy = longTrigger && closeArr[i] > emaFast[i] && closeArr[i] > emaSlow[i] && rsiVal[i] < 75 && bullScore >= minScore && passesGrade && bullHTFOk && bullADXOk;
      const buyCondition = rawBuy && lastDirection !== 1;

      if (activeTrade && i > entryBarIndex) {
        if (activeTrade.dir === 1) {
          if (highArr[i] >= activeTrade.tp1Price && !activeTrade.tp1Hit) {
            activeTrade.tp1Hit = true;
            activeTrade.trailPrice = activeTrade.entryPrice;
          }
          if (highArr[i] >= activeTrade.tp2Price && !activeTrade.tp2Hit) {
            activeTrade.tp2Hit = true;
            activeTrade.trailPrice = activeTrade.tp1Price;
          }
          if (highArr[i] >= activeTrade.tp3Price && !activeTrade.tp3Hit) {
            activeTrade.tp3Hit = true;
            activeTrade.trailPrice = activeTrade.tp2Price;
          }
          if (lowArr[i] <= activeTrade.trailPrice) {
            activeTrade.slHit = true;
            totalTrades++;
            if (activeTrade.tp1Hit) winningTrades++;
            activeTrade = null;
            lastDirection = 0;
          }
        }
      }

      if (buyCondition && !activeTrade) {
        lastDirection = 1;
        const recentSwingLow = getSwingLow(lowArr, i, 10);
        const risk = atrVal[i] * 2.5;
        const slPrice = calcSL(true, closeArr[i], risk, atrVal[i], recentSwingLow, 0);
        const tradeRisk = Math.abs(closeArr[i] - slPrice);
        activeTrade = {
          dir: 1, entryPrice: closeArr[i], slPrice: slPrice,
          tp1Price: closeArr[i] + tradeRisk * 1.0,
          tp2Price: closeArr[i] + tradeRisk * 2.0,
          tp3Price: closeArr[i] + tradeRisk * 3.0,
          trailPrice: slPrice, tp1Hit: false, tp2Hit: false, tp3Hit: false, slHit: false,
          score: bullScore, grade: bullScore >= 8.0 ? 'A+' : bullScore >= 6.5 ? 'A' : 'B'
        };
        entryBarIndex = i;
      }
    }

    const latestIdx = size - 1;
    const finalClose = closeArr[latestIdx];
    const finalEmaFast = emaFast[latestIdx];
    const finalEmaSlow = emaSlow[latestIdx];
    const finalEmaTrend = emaTrend[latestIdx];
    let activeScore = 0;
    
    if (activeTrade) {
        activeScore = activeTrade.score;
    } else {
        // Calculate latest score if no active trade
        let latestBullScore = 0.0;
        latestBullScore += finalEmaFast > finalEmaSlow ? 1.0 : 0.0;
        latestBullScore += finalClose > emaTrend[latestIdx] ? 1.0 : 0.0;
        latestBullScore += rsiVal[latestIdx] > 50 && rsiVal[latestIdx] < 75 ? 1.0 : 0.0;
        latestBullScore += macd.histLine[latestIdx] > 0 ? 1.0 : 0.0;
        latestBullScore += macd.macdLine[latestIdx] > macd.signalLine[latestIdx] ? 1.0 : 0.0;
        latestBullScore += finalClose > ((highArr[latestIdx] + lowArr[latestIdx] + finalClose) / 3) ? 1.0 : 0.0;
        latestBullScore += volArr[latestIdx] > volSma[latestIdx] * volMult ? 1.0 : 0.0;
        latestBullScore += dmi.adx[latestIdx] > 20 && dmi.diPlus[latestIdx] > dmi.diMinus[latestIdx] ? 1.0 : 0.0;
        latestBullScore += (finalEmaFast > finalEmaSlow ? 1 : -1) === 1 ? 1.5 : 0.0;
        latestBullScore += finalClose > finalEmaFast ? 0.5 : 0.0;
        activeScore = latestBullScore;
    }

    let tradeStatus = "No Trade";
    let action = 'AVOID';
    
    if (activeTrade) {
      if (activeTrade.tp3Hit) tradeStatus = "TP3 ✓ — Trail";
      else if (activeTrade.tp2Hit) tradeStatus = "TP2 ✓ — Trail";
      else if (activeTrade.tp1Hit) tradeStatus = "TP1 ✓ — Trail";
      else tradeStatus = "Active";

      const isPastEntryZone = finalClose > activeTrade.entryPrice * 1.02;
      const isTPHit = activeTrade.tp1Hit || activeTrade.tp2Hit || activeTrade.tp3Hit;
      
      if (isTPHit || isPastEntryZone) {
        action = 'HOLD';
      } else {
        action = 'BUY';
      }
    } else {
      if (finalEmaFast > finalEmaSlow && finalClose > finalEmaTrend) {
        action = 'WATCH';
      }
    }

    const winRateStr = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : "0.0";

    const last5Highs = highArr.slice(-5);
    const highestPrice = last5Highs.length > 0 ? Math.max(...last5Highs) : finalClose;

    let stopLoss = 0, tp1 = 0, tp2 = 0, tp3 = 0, tp4 = 0;
    if (activeTrade) {
      stopLoss = activeTrade.slPrice;
      tp1 = activeTrade.tp1Price;
      tp2 = activeTrade.tp2Price;
      tp3 = activeTrade.tp3Price;
      const currentRisk = Math.abs(activeTrade.entryPrice - activeTrade.slPrice);
      tp4 = activeTrade.entryPrice + (currentRisk * 4.0);
    } else {
      const recentSwingLow = getSwingLow(lowArr, latestIdx, 10);
      const currentAtr = atrVal[latestIdx];
      const sl1 = recentSwingLow - (currentAtr * 0.2);
      const sl2 = finalClose - (currentAtr * 1.5);
      stopLoss = Math.min(sl1, sl2);
      const risk = Math.max(0.01, finalClose - stopLoss);
      tp1 = finalClose + (risk * 1.5);
      tp2 = finalClose + (risk * 2.5);
      tp3 = finalClose + (risk * 3.5);
      tp4 = finalClose + (risk * 4.5);
    }

    const staticTargets = getStaticGannTargets(finalClose, 1);

    return {
      ticker: cleanTicker,
      name: yahooData.companyName,
      price: livePrice,
      action: action,
      score: activeScore.toFixed(1),
      status: tradeStatus,
      winRate: winRateStr,
      totalTrades: totalTrades,
      highestPrice: highestPrice.toFixed(2),
      stopLoss: stopLoss.toFixed(2),
      tp1: tp1.toFixed(2),
      tp2: tp2.toFixed(2),
      tp3: tp3.toFixed(2),
      tp4: tp4.toFixed(2),
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
      category: category,
    };

  } catch (err) {
    console.error("Error processing " + cleanTicker, err);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filterType = url.searchParams.get('type') || 'day_gainers';
    
    // 1. Fetch top tickers from Yahoo
    let tickersToScan: {symbol: string, category: string}[] = [];

    if (filterType === 'top_swing_picks') {
      const screenerIds = [
        { id: 'day_gainers', label: 'Day Gainers' }, 
        { id: 'most_actives', label: 'Most Actives' }, 
        { id: 'aggressive_small_caps', label: 'Small Caps' }
      ];
      
      const fetchPromises = screenerIds.map(async (sid) => {
        const fetchUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${sid.id}&count=15`;
        try {
          const res = await fetch(fetchUrl);
          const data = await res.json();
          return (data.finance?.result?.[0]?.quotes || []).map((q: any) => ({ symbol: q.symbol, category: sid.label }));
        } catch (e) {
          console.error(`Failed fetching screener ${sid.id}`, e);
          return [];
        }
      });
      
      const resultsArray = await Promise.all(fetchPromises);
      const allTickers = resultsArray.flat();
      
      // Remove duplicates, preserving combined categories
      const tickerMap = new Map<string, string[]>();
      allTickers.forEach(t => {
        if (!tickerMap.has(t.symbol)) {
          tickerMap.set(t.symbol, [t.category]);
        } else {
          const existing = tickerMap.get(t.symbol)!;
          if (!existing.includes(t.category)) existing.push(t.category);
        }
      });
      
      tickersToScan = Array.from(tickerMap.entries()).map(([symbol, categories]) => ({
        symbol,
        category: categories.join(' + ')
      })).slice(0, 30);
      
    } else {
      let fetchUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${filterType}&count=25`;
      const res = await fetch(fetchUrl);
      const data = await res.json();
      const quotes = data.finance?.result?.[0]?.quotes || [];
      const labelMap: any = {
        'day_gainers': 'Day Gainers',
        'most_actives': 'Most Actives',
        'day_losers': 'Day Losers',
        'fifty_two_wk_gainers': '52-Week Highs',
        'aggressive_small_caps': 'Small Caps',
        'growth_technology_stocks': 'Growth Tech'
      };
      tickersToScan = quotes.map((q: any) => ({ symbol: q.symbol, category: labelMap[filterType] || filterType })).slice(0, 25);
    }
    
    // Add some interesting hardcoded US/MY stocks as backup or extra?
    if (tickersToScan.length === 0) {
      const fallbacks = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'PLTR', 'SNOW', 'CRWD'];
      tickersToScan = fallbacks.map(symbol => ({ symbol, category: 'Fallback' }));
    }

    console.log("[Screener] Scanning tickers:", tickersToScan.map(t => t.symbol));

    // 2. Process concurrently
    const results = await Promise.all(tickersToScan.map(t => processTicker(t.symbol, t.category)));
    
    // 3. Filter only BUY or HOLD or high scores and ensure price >= 20 for US
    const validResults = results.filter((r: any) => {
      if (r === null) return false;
      const isBursa = r.ticker.endsWith('.KL') || r.ticker.endsWith('.MY') || /^\d{4}$/.test(r.ticker);
      if (!isBursa && parseFloat(r.price) < 20) return false;
      return r.action === 'BUY' || r.action === 'HOLD' || parseFloat(r.score) >= 7.0;
    });
    
    // 4. Sort by score descending
    validResults.sort((a: any, b: any) => parseFloat(b.score) - parseFloat(a.score));

    return NextResponse.json({
        count: validResults.length,
        results: validResults
    });

  } catch (error: any) {
    console.error('[Screener] API Handler Crash:', error);
    return NextResponse.json(
      { error: 'Internal error during screening: ' + error.message },
      { status: 500 }
    );
  }
}
