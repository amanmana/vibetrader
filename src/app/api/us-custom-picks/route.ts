import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

function getLatestUSFridayCloseMs(): { fridayMs: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, parseInt(p.value, 10)]));
  
  const y = partMap.year;
  const m = partMap.month - 1;
  const d = partMap.day;
  const h = partMap.hour;
  
  const nyTimeMs = Date.UTC(y, m, d, h);
  const nyDate = new Date(nyTimeMs);
  const dayOfWeek = nyDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  
  let daysToSubtract = 0;
  if (dayOfWeek === 6) {
    daysToSubtract = 1;
  } else if (dayOfWeek === 0) {
    daysToSubtract = 2;
  } else if (dayOfWeek === 5) {
    daysToSubtract = h < 16 ? 7 : 0;
  } else {
    daysToSubtract = dayOfWeek + 2;
  }
  
  const targetFridayDate = new Date(nyTimeMs);
  targetFridayDate.setUTCDate(targetFridayDate.getUTCDate() - daysToSubtract);
  
  const fridayEndNY = Date.UTC(
    targetFridayDate.getUTCFullYear(),
    targetFridayDate.getUTCMonth(),
    targetFridayDate.getUTCDate(),
    23, 59, 59
  );
  
  let absoluteMs = fridayEndNY;
  for (let i = 0; i < 3; i++) {
    const testDate = new Date(absoluteMs);
    const testParts = formatter.formatToParts(testDate);
    const testMap = Object.fromEntries(testParts.map(p => [p.type, parseInt(p.value, 10)]));
    const testNyUtcMs = Date.UTC(testMap.year, testMap.month - 1, testMap.day, testMap.hour, testMap.minute, testMap.second);
    const diff = testNyUtcMs - fridayEndNY;
    absoluteMs -= diff;
  }
  
  return { fridayMs: absoluteMs };
}

// 1. GET: Retrieve all saved picks and fetch their LIVE prices dynamically
export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const { results } = await db.prepare(`
      SELECT * FROM us_custom_picks 
      ORDER BY score DESC, created_at DESC
    `).all();

    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const symbols = results.map((r: any) => r.symbol);
    
    // Fetch current prices from Yahoo
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

          const { fridayMs } = getLatestUSFridayCloseMs();

          let lastWeekClose = currentLivePrice;
          let lastWeekDateStr = '';
          let currentWeekHighest = currentHigh;

          for (let i = timestamps.length - 1; i >= 0; i--) {
            // Yahoo timestamps are in seconds
            const ts = timestamps[i] * 1000;
            if (ts > fridayMs) {
              // Day in current week, track the highest high
              if (highs[i] && highs[i] > currentWeekHighest) {
                currentWeekHighest = highs[i];
              }
            } else {
              // First day before current week's Monday
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
            meta: result.meta,
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

    // Merge live price with static DB data
    const finalData = results.map((row: any) => {
      const q = quoteMap[row.symbol];
      const basePrice = q?.lastWeekClose || row.price;
      const currentLivePrice = q?.currentLivePrice || row.price;
      const currentHigh = q?.currentHigh || currentLivePrice;
      const newHighestPrice = currentHigh;

      const gann = getStaticGannTargets(basePrice, 1);

      return {
        id: row.id,
        ticker: row.symbol,
        name: row.company_name,
        price: basePrice.toFixed(2),
        currentPrice: currentLivePrice.toFixed(2),
        lastDoneDate: q?.lastWeekDateStr || '',
        highestPrice: newHighestPrice.toFixed(2),
        score: row.score,
        staticSL: gann.staticSL,
        staticSLColor: gann.staticSLColor,
        staticTP1: gann.staticTP1,
        staticTP1Color: gann.staticTP1Color,
        staticTP2: gann.staticTP2,
        staticTP2Color: gann.staticTP2Color,
        staticTP3: gann.staticTP3,
        staticTP3Color: gann.staticTP3Color,
        staticTP4: gann.staticTP4,
        staticTP4Color: gann.staticTP4Color,
        labelColor: row.label_color || null,
      };
    });

    return NextResponse.json({ success: true, data: finalData });
  } catch (error: any) {
    console.error("GET US Custom Picks Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. POST: Save a pick to the watchlist
export async function POST(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const body = await req.json();
    const { action, color, ticker, name, price, score, highestPrice, staticSL, staticSLColor, staticTP1, staticTP1Color, staticTP2, staticTP2Color, staticTP3, staticTP3Color } = body;

    // Handle Label Color update
    if (action === 'label' && ticker) {
      const cleanSym = ticker.trim().toUpperCase();
      const labelColor = color || null;
      await db.prepare('UPDATE us_custom_picks SET label_color = ? WHERE symbol = ?')
        .bind(labelColor, cleanSym)
        .run();
      return NextResponse.json({ success: true, ticker: cleanSym, color: labelColor });
    }

    if (!ticker || !name) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const dateStr = new Date().toISOString();

    const existing = await db.prepare(`SELECT id FROM us_custom_picks WHERE symbol = ?`).bind(ticker).first();
    if (existing) {
      return NextResponse.json({ success: false, error: "Already in Watchlist" }, { status: 400 });
    }

    await db.prepare(`
      INSERT INTO us_custom_picks (
        id, date, symbol, company_name, price, score, highest_price,
        static_sl, static_sl_color, static_tp1, static_tp1_color,
        static_tp2, static_tp2_color, static_tp3, static_tp3_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, dateStr, ticker, name, parseFloat(price), parseFloat(score), parseFloat(highestPrice),
      parseFloat(staticSL), staticSLColor, parseFloat(staticTP1), staticTP1Color,
      parseFloat(staticTP2), staticTP2Color, parseFloat(staticTP3), staticTP3Color
    ).run();

    return NextResponse.json({ success: true, message: "Saved to Watchlist" });
  } catch (error: any) {
    console.error("POST US Custom Picks Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. DELETE: Remove a pick from the watchlist
export async function DELETE(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const url = new URL(req.url);
    const ticker = url.searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ success: false, error: "Missing ticker parameter" }, { status: 400 });
    }

    await db.prepare(`DELETE FROM us_custom_picks WHERE symbol = ?`).bind(ticker).run();

    return NextResponse.json({ success: true, message: "Removed from Watchlist" });
  } catch (error: any) {
    console.error("DELETE US Custom Picks Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
