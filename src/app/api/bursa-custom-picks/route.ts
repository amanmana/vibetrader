import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

// Retrieve Custom Master List and calculate live prices
export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    // Fetch ALL picks in the custom table
    const { results } = await db.prepare(`
      SELECT * FROM custom_picks 
      ORDER BY score DESC
    `).all();

    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, data: [], lastUpdated: null });
    }

    const lastUpdated = results[0].date || null;

    // Fetch current prices from Yahoo
    const symbols = results.map((r: any) => r.symbol);
    
    // Max 30-100 symbols
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

          // find last week's close (last trading day before current week's Monday)
          const now = new Date();
          // get time in Malaysia (UTC+8)
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
            // Yahoo timestamps are in seconds
            const ts = timestamps[i] * 1000;
            if (ts >= mondayStartMs) {
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

    // Attach hit flags
    const enrichedResults = results.map((row: any) => {
      const q = quoteMap[row.symbol];
      const basePrice = q?.lastWeekClose || row.price;
      const currentLivePrice = q?.currentLivePrice || row.price;
      const currentHigh = q?.currentHigh || currentLivePrice;
      const newHighestPrice = currentHigh;
      
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
        highestPrice: newHighestPrice.toFixed(3),
        
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

// Save Custom Scan results to Master List
export async function POST(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { results } = await req.json();
    
    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    
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
        parseFloat(pick.tp4),
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
