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

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json();

    if (!ticker || typeof ticker !== 'string') {
      return NextResponse.json(
        { error: 'Please enter a valid stock code' },
        { status: 400 }
      );
    }

    const cleanTicker = ticker.trim().toUpperCase();
    console.log("[DEBUG] Clean ticker:", cleanTicker);

    // Fetch live & historical prices from Yahoo Finance
    const yahooData = await fetchYahooPrice(cleanTicker);
    if (!yahooData) {
      return NextResponse.json(
        { error: `Stock symbol "${cleanTicker}" does not exist or was not found.` }
      );
    }

    const livePrice = yahooData.price;
    const liveCompanyName = yahooData.companyName;
    const liveCurrency = yahooData.currency;
    const candles = yahooData.candles;

    // Detect exchange profile
    const isBursa = cleanTicker.endsWith('.KL') || cleanTicker.endsWith('.MY') || BURSA_MAPPING[cleanTicker] !== undefined || /^\d{4}$/.test(cleanTicker);
    const marketProfile = isBursa ? 'Bursa' : 'US';

    // Technical metrics arrays
    const closeArr = candles.map(c => c.close);
    const highArr = candles.map(c => c.high);
    const lowArr = candles.map(c => c.low);
    const openArr = candles.map(c => c.open);
    const volArr = candles.map(c => c.volume);

    // Indicator calculations
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

    // Profile inputs
    const minScore = isBursa ? 6.5 : 5.0;
    const volMult = isBursa ? 1.00 : 1.20;
    const requireHTF = isBursa;
    const requireADX = isBursa;

    let lastDirection = 0;
    let activeTrade: any = null;
    let entryBarIndex = -1;

    let totalTrades = 0;
    let winningTrades = 0;

    // Backtest/trade state tracking simulation bar-by-bar
    for (let i = WARMUP; i < size; i++) {
      // 1. Scoring
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

      let bearScore = 0.0;
      bearScore += emaFast[i] < emaSlow[i] ? 1.0 : 0.0;
      bearScore += closeArr[i] < emaTrend[i] ? 1.0 : 0.0;
      bearScore += rsiVal[i] < 50 && rsiVal[i] > 25 ? 1.0 : 0.0;
      bearScore += macd.histLine[i] < 0 ? 1.0 : 0.0;
      bearScore += macd.macdLine[i] < macd.signalLine[i] ? 1.0 : 0.0;
      bearScore += closeArr[i] < ((highArr[i] + lowArr[i] + closeArr[i]) / 3) ? 1.0 : 0.0;
      bearScore += volAbove ? 1.0 : 0.0;
      bearScore += strongTrend && dmi.diMinus[i] > dmi.diPlus[i] ? 1.0 : 0.0;
      bearScore += htfBias === -1 ? 1.5 : 0.0;
      bearScore += closeArr[i] < emaFast[i] ? 0.5 : 0.0;

      // 2. Triggers
      const emaBullCross = emaFast[i] > emaSlow[i] && emaFast[i - 1] <= emaSlow[i - 1];
      const emaBearCross = emaFast[i] < emaSlow[i] && emaFast[i - 1] >= emaSlow[i - 1];

      const longPullbackZone = lowArr[i] <= emaFast[i] || lowArr[i] <= emaSlow[i];
      const longPullbackBounce = longPullbackZone && closeArr[i] > emaFast[i] && closeArr[i] > emaSlow[i] && closeArr[i] > openArr[i];

      const breakoutHigh = Math.max(...highArr.slice(Math.max(0, i - 5), i));
      const longBreakout = closeArr[i] > breakoutHigh && closeArr[i] > emaFast[i] && closeArr[i] > emaSlow[i] && closeArr[i] > emaTrend[i] && volAbove;

      const longTrigger = isBursa ? longPullbackBounce : (emaBullCross || longPullbackBounce || longBreakout);

      const passesGrade = bullScore >= 5.0; // hideCGrade is true
      const bullHTFOk = requireHTF ? htfBias === 1 : true;
      const bullADXOk = requireADX ? (strongTrend && dmi.diPlus[i] > dmi.diMinus[i]) : true;

      const rawBuy = longTrigger && closeArr[i] > emaFast[i] && closeArr[i] > emaSlow[i] && rsiVal[i] < 75 && bullScore >= minScore && passesGrade && bullHTFOk && bullADXOk;

      const buyCondition = rawBuy && lastDirection !== 1;

      // 3. Trade SL/TP hits checks
      if (activeTrade && i > entryBarIndex) {
        if (activeTrade.dir === 1) {
          // Trailing stops
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
          // SL check
          if (lowArr[i] <= activeTrade.trailPrice) {
            activeTrade.slHit = true;
            totalTrades++;
            if (activeTrade.tp1Hit) winningTrades++;
            activeTrade = null;
            lastDirection = 0;
          }
        }
      }

      // 4. Signal confirmation
      if (buyCondition && !activeTrade) {
        lastDirection = 1;
        const recentSwingLow = getSwingLow(lowArr, i, 10);
        const risk = atrVal[i] * 2.5;
        const slPrice = calcSL(true, closeArr[i], risk, atrVal[i], recentSwingLow, 0);
        const tradeRisk = Math.abs(closeArr[i] - slPrice);
        
        activeTrade = {
          dir: 1,
          entryPrice: closeArr[i],
          slPrice: slPrice,
          tp1Price: closeArr[i] + tradeRisk * 1.0,
          tp2Price: closeArr[i] + tradeRisk * 2.0,
          tp3Price: closeArr[i] + tradeRisk * 3.0,
          trailPrice: slPrice,
          tp1Hit: false,
          tp2Hit: false,
          tp3Hit: false,
          slHit: false,
          score: bullScore,
          grade: bullScore >= 8.0 ? 'A+' : bullScore >= 6.5 ? 'A' : 'B'
        };
        entryBarIndex = i;
      }
    }

    // Determine final states based on the last bar
    const latestIdx = size - 1;
    const finalClose = closeArr[latestIdx];
    const finalEmaFast = emaFast[latestIdx];
    const finalEmaSlow = emaSlow[latestIdx];
    const finalEmaTrend = emaTrend[latestIdx];
    const finalRsi = rsiVal[latestIdx];
    const finalAdx = dmi.adx[latestIdx];
    const finalAtr = atrVal[latestIdx];

    const trendStr = finalEmaFast > finalEmaSlow && finalClose > finalEmaTrend ? "Bullish" : finalEmaFast < finalEmaSlow && finalClose < finalEmaTrend ? "Bearish" : "Neutral";
    const htfBiasStr = finalEmaFast > finalEmaSlow ? "Bullish" : finalEmaFast < finalEmaSlow ? "Bearish" : "Neutral";

    const atrSmaGlobal = atrVal.slice(Math.max(0, latestIdx - 42)).reduce((a, b) => a + b, 0) / Math.min(42, latestIdx + 1);
    const volRatio = finalAtr / (atrSmaGlobal || 1);
    const volRegime = volRatio > 1.3 ? "High" : volRatio < 0.7 ? "Low" : "Normal";

    // Score on the latest bar
    let latestBullScore = 0.0;
    latestBullScore += finalEmaFast > finalEmaSlow ? 1.0 : 0.0;
    latestBullScore += finalClose > finalEmaTrend ? 1.0 : 0.0;
    latestBullScore += finalRsi > 50 && finalRsi < 75 ? 1.0 : 0.0;
    latestBullScore += macd.histLine[latestIdx] > 0 ? 1.0 : 0.0;
    latestBullScore += macd.macdLine[latestIdx] > macd.signalLine[latestIdx] ? 1.0 : 0.0;
    latestBullScore += finalClose > ((highArr[latestIdx] + lowArr[latestIdx] + finalClose) / 3) ? 1.0 : 0.0;
    latestBullScore += volArr[latestIdx] > volSma[latestIdx] * volMult ? 1.0 : 0.0;
    latestBullScore += finalAdx > 20 && dmi.diPlus[latestIdx] > dmi.diMinus[latestIdx] ? 1.0 : 0.0;
    latestBullScore += (finalEmaFast > finalEmaSlow ? 1 : -1) === 1 ? 1.5 : 0.0;
    latestBullScore += finalClose > finalEmaFast ? 0.5 : 0.0;

    const latestSwingLowVal = getSwingLow(lowArr, latestIdx, 10);
    const latestSwingHighVal = getSwingHigh(highArr, latestIdx, 10);

    let tradeStatus = "No Trade";
    let activeScore = latestBullScore;
    if (activeTrade) {
      if (activeTrade.tp3Hit) tradeStatus = "TP3 ✓ — Trail";
      else if (activeTrade.tp2Hit) tradeStatus = "TP2 ✓ — Trail";
      else if (activeTrade.tp1Hit) tradeStatus = "TP1 ✓ — Trail";
      else tradeStatus = "Active";
      activeScore = activeTrade.score;
    }

    // Set decision based on trend & score
    let action: 'BUY' | 'HOLD' | 'WATCH' | 'AVOID' = 'AVOID';
    let reasoning = "";
    let confidenceLevel: 'High' | 'Medium' | 'Low' = 'Low';

    if (activeTrade) {
      const isPastEntryZone = finalClose > activeTrade.entryPrice * 1.02;
      const isTPHit = activeTrade.tp1Hit || activeTrade.tp2Hit || activeTrade.tp3Hit;
      
      if (isTPHit || isPastEntryZone) {
        action = 'HOLD';
        reasoning = `Adaptive Sniper active trade. Entry at ${activeTrade.entryPrice.toFixed(2)} was already triggered. Current price has moved away from the safe entry zone. Hold if you are already in. Status is currently ${tradeStatus}.`;
      } else {
        action = 'BUY';
        reasoning = `Adaptive Sniper active trade. Long entry triggered at ${activeTrade.entryPrice.toFixed(2)} with score ${activeTrade.score}/10 (${activeTrade.grade} Grade). Price is in optimal entry zone. Status is currently ${tradeStatus}.`;
      }
      confidenceLevel = activeTrade.grade === 'A+' || activeTrade.grade === 'A' ? 'High' : 'Medium';
    } else {
      if (trendStr === 'Bullish') {
        action = 'WATCH';
        confidenceLevel = 'Medium';
        reasoning = `Trend structure is bullish, but no active Sniper entry has triggered on the daily chart. Waiting for a valid pullback bounce or breakout.`;
      } else {
        action = 'AVOID';
        confidenceLevel = 'High';
        reasoning = `Market structure is bearish or neutral. Adaptive Sniper recommends avoiding this stock until a clear trend alignment occurs.`;
      }
    }

    // Determine return levels (active trade levels or potential setups if watching)
    let entryPriceVal = finalClose;
    let stopLossVal = finalClose - finalAtr * 2.5;
    let tp1Val = finalClose + finalAtr * 2.5;
    let tp2Val = finalClose + finalAtr * 5.0;
    let tp3Val = finalClose + finalAtr * 7.5;

    if (activeTrade) {
      entryPriceVal = activeTrade.entryPrice;
      stopLossVal = activeTrade.slPrice;
      tp1Val = activeTrade.tp1Price;
      tp2Val = activeTrade.tp2Price;
      tp3Val = activeTrade.tp3Price;
    } else if (action === 'WATCH') {
      const recentSwingLow = getSwingLow(lowArr, latestIdx, 10);
      const risk = finalAtr * 2.5;
      stopLossVal = calcSL(true, finalClose, risk, finalAtr, recentSwingLow, 0);
      const tradeRisk = Math.abs(finalClose - stopLossVal);
      tp1Val = finalClose + tradeRisk * 1.0;
      tp2Val = finalClose + tradeRisk * 2.0;
      tp3Val = finalClose + tradeRisk * 3.0;
    } else {
      entryPriceVal = 0;
      stopLossVal = 0;
      tp1Val = 0;
      tp2Val = 0;
      tp3Val = 0;
    }

    const gann = getStaticGannTargets(finalClose, 1);

    let parsedJSON: any = null;

    try {
      const myRequestContext = getRequestContext();
      const aiBinding = (myRequestContext?.env as any)?.AI;

      if (aiBinding) {
        console.log("[DEBUG] Calling Cloudflare Workers AI (Llama-3)...");

        const systemInstruction = `You are 'Adaptive Sniper AI', a highly disciplined algorithmic swing trader specializing in trend-following and pullback trading strategies. Your task is to analyze the provided stock data and indicator values to generate a swing trading review.

ANALYSIS PARAMETERS:
1. Trend Structure: Based on EMA-13, EMA-34, EMA-89.
2. Momentum & Volatility: Based on RSI-21, ADX-14, DMI, Volume SMA-20, and ATR-20.
3. Confluence Score: Analyze the Adaptive Sniper confluence score (${activeScore} / 10).

OUTPUT RULES:
Your output must be strictly in valid JSON format. Do not include markdown fences, backticks, or any explanatory text outside the JSON.

JSON OUTPUT FORMAT:
{
  "ticker": "${cleanTicker}",
  "company_name": "${liveCompanyName ? liveCompanyName : cleanTicker}",
  "trend_analysis": {
    "market_structure": "${trendStr} Structure",
    "pattern_detected": "${activeTrade ? 'Pullback Sniper Entry' : 'Consolidation / Pullback Zone'}",
    "gann_confluence": "EMA-13 is ${finalEmaFast > finalEmaSlow ? 'above' : 'below'} EMA-34 and close is ${finalClose > finalEmaTrend ? 'above' : 'below'} Trend Line (EMA-89). Volume SMA-20 shows volume is ${volArr[latestIdx] > volSma[latestIdx] ? 'expanding' : 'neutral'}."
  },
  "trading_decision": {
    "action": "${action}",
    "confidence_level": "${confidenceLevel}",
    "reasoning": "${reasoning}"
  },
  "levels": {
    "entry_price": ${entryPriceVal},
    "stop_loss": ${stopLossVal},
    "take_profit_1": ${tp1Val},
    "take_profit_2": ${tp2Val},
    "take_profit_3": ${tp3Val},
    "static_sl": ${gann.staticSL},
    "static_tp1": ${gann.staticTP1},
    "static_tp2": ${gann.staticTP2}
  },
  "technical_indicators": {
    "current_price": ${livePrice},
    "sma_50": ${finalEmaSlow},
    "volume_trend": "${volArr[latestIdx] > volSma[latestIdx] * volMult ? 'Bullish / Expanding' : 'Neutral / Steady'}",
    "candlestick_info": "${finalClose > openArr[latestIdx] ? 'Bullish Candle' : 'Bearish Candle'} near EMA Ribbon"
  },
  "adaptive_sniper": {
    "trend": "${trendStr}",
    "score": "${activeScore.toFixed(1)} / 10",
    "status": "${tradeStatus}",
    "htf_bias": "${htfBiasStr}",
    "market": "${marketProfile}",
    "volatility": "${volRegime}",
    "rsi": "${finalRsi.toFixed(1)}",
    "adx": "${finalAdx.toFixed(1)}",
    "preset": "Swing"
  }
}`;

        const prompt = `Perform swing trading technical analysis for stock ${cleanTicker} using live price data:
        - Current price: ${livePrice} ${liveCurrency}
        - Company name: ${liveCompanyName ? liveCompanyName : cleanTicker}

        Provide accurate market analysis based on the parameters above. Return the answer strictly in the specified JSON format.`;

        const result: any = await aiBinding.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ]
        });

        const textResponse = result?.response;
        console.log("[DEBUG] Workers AI response length:", textResponse?.length || 0);
        
        if (textResponse) {
          const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (parsed && parsed.trend_analysis && parsed.trading_decision) {
            parsedJSON = parsed;
          }
        }
      }
    } catch (aiError: any) {
      console.warn('[DEBUG] Cloudflare Workers AI call failed, using local math engine:', aiError?.message || aiError);
      parsedJSON = null;
    }

    // Fallback: Local math engine
    if (!parsedJSON) {
      parsedJSON = {
        ticker: cleanTicker,
        company_name: liveCompanyName,
        trend_analysis: {
          market_structure: `${trendStr} Structure`,
          pattern_detected: activeTrade ? 'Pullback Sniper Entry' : 'Consolidation / Pullback Zone',
          gann_confluence: `EMA-13 is ${finalEmaFast > finalEmaSlow ? 'above' : 'below'} EMA-34 and close is ${finalClose > finalEmaTrend ? 'above' : 'below'} Trend Line (EMA-89).`,
        },
        trading_decision: {
          action: action,
          confidence_level: confidenceLevel,
          reasoning: reasoning,
        },
        levels: {
          entry_price: parseFloat(entryPriceVal.toFixed(2)),
          stop_loss: parseFloat(stopLossVal.toFixed(2)),
          take_profit_1: parseFloat(tp1Val.toFixed(2)),
          take_profit_2: parseFloat(tp2Val.toFixed(2)),
          take_profit_3: parseFloat(tp3Val.toFixed(2)),
          static_sl: parseFloat(gann.staticSL),
          static_tp1: parseFloat(gann.staticTP1),
          static_tp2: parseFloat(gann.staticTP2),
          support: parseFloat(latestSwingLowVal.toFixed(2)),
          resistance: parseFloat(latestSwingHighVal.toFixed(2))
        },
        technical_indicators: {
          current_price: livePrice,
          sma_50: parseFloat(finalEmaSlow.toFixed(2)),
          volume_trend: volArr[latestIdx] > volSma[latestIdx] * volMult ? 'Bullish / Expanding' : 'Neutral / Steady',
          candlestick_info: finalClose > openArr[latestIdx] ? 'Bullish Candle' : 'Bearish Candle',
        },
        adaptive_sniper: {
          trend: trendStr,
          score: `${activeScore.toFixed(1)} / 10`,
          status: tradeStatus,
          htf_bias: htfBiasStr,
          market: marketProfile,
          volatility: volRegime,
          rsi: finalRsi.toFixed(1),
          adx: finalAdx.toFixed(1),
          preset: 'Swing'
        }
      };
    }

    // Enforce math overwrite in JSON to avoid AI hallucinations
    if (parsedJSON) {
      parsedJSON.levels = {
        entry_price: parseFloat(entryPriceVal.toFixed(2)),
        stop_loss: parseFloat(stopLossVal.toFixed(2)),
        take_profit_1: parseFloat(tp1Val.toFixed(2)),
        take_profit_2: parseFloat(tp2Val.toFixed(2)),
        take_profit_3: parseFloat(tp3Val.toFixed(2)),
        static_sl: parseFloat(gann.staticSL),
        static_tp1: parseFloat(gann.staticTP1),
        static_tp2: parseFloat(gann.staticTP2),
        support: parseFloat(latestSwingLowVal.toFixed(2)),
        resistance: parseFloat(latestSwingHighVal.toFixed(2))
      };
      
      parsedJSON.adaptive_sniper = {
        trend: trendStr,
        score: `${activeScore.toFixed(1)} / 10`,
        status: tradeStatus,
        htf_bias: htfBiasStr,
        market: marketProfile,
        volatility: volRegime,
        rsi: finalRsi.toFixed(1),
        adx: finalAdx.toFixed(1),
        preset: 'Swing'
      };

      parsedJSON.backtest = {
        total_trades: totalTrades,
        winning_trades: winningTrades,
        win_rate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : "0.0"
      };
    }

    console.log("[DEBUG] Returning parsedJSON status:", !!parsedJSON);
    return NextResponse.json(parsedJSON);

  } catch (error: any) {
    console.error('[DEBUG] API Handler Crash:', error?.message || error, error?.stack || '');
    return NextResponse.json(
      { error: 'Internal error during analysis: ' + (error?.message || error) },
      { status: 500 }
    );
  }
}
