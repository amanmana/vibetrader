import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getStaticGannTargets } from '@/utils/gann';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    // Fetch ALL picks in the table (since we clear it before updating)
    const { results } = await db.prepare(`
      SELECT * FROM daily_picks 
      ORDER BY score DESC
    `).all();

    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, data: [], lastUpdated: null });
    }

    const lastUpdated = results[0].date || null;

    // Now, fetch current prices from Yahoo to see if TPs were hit today
    const symbols = results.map((r: any) => r.symbol);
    const symbolsStr = symbols.join(',');
    
    // Max 30 symbols. v7 quote API is blocked, use v8 chart API concurrently
    const quotePromises = symbols.map(async (sym: string) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, {
          headers: {
            "User-Agent": "Mozilla/5.0 TradeNetMY/1.0",
            "Accept": "application/json"
          },
          cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (data?.chart?.result?.[0]?.meta) {
          return { symbol: sym, meta: data.chart.result[0].meta };
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
          regularMarketPrice: res.meta.regularMarketPrice,
          regularMarketDayHigh: res.meta.regularMarketDayHigh
        };
      }
    }

    // Attach hit flags
    const enrichedResults = results.map((row: any) => {
      const q = quoteMap[row.symbol];
      const currentLivePrice = q?.regularMarketPrice || row.price;
      const currentHigh = q?.regularMarketDayHigh || currentLivePrice;
      const newHighestPrice = Math.max(row.highest_price, currentHigh);
      
      return {
        symbol: row.symbol,
        companyName: row.company_name,
        price: currentLivePrice.toFixed(3),
        score: row.score.toFixed(1),
        stopLoss: row.stop_loss.toFixed(3),
        tp1: row.tp1.toFixed(3),
        tp2: row.tp2.toFixed(3),
        tp3: row.tp3.toFixed(3),
        tp4: row.tp4.toFixed(3),
        highestPrice: newHighestPrice.toFixed(3),
        
        staticSL: getStaticGannTargets(row.price).staticSL,
        staticSLColor: getStaticGannTargets(row.price).staticSLColor,
        staticTP1: getStaticGannTargets(row.price).staticTP1,
        staticTP1Color: getStaticGannTargets(row.price).staticTP1Color,
        staticTP2: getStaticGannTargets(row.price).staticTP2,
        staticTP2Color: getStaticGannTargets(row.price).staticTP2Color,
        staticTP3: getStaticGannTargets(row.price).staticTP3,
        staticTP3Color: getStaticGannTargets(row.price).staticTP3Color,
        staticTP4: getStaticGannTargets(row.price).staticTP4,
        staticTP4Color: getStaticGannTargets(row.price).staticTP4Color,

        hitTp1: currentHigh >= row.tp1,
        hitTp2: currentHigh >= row.tp2,
        hitTp3: currentHigh >= row.tp3,
        hitTp4: currentHigh >= row.tp4,
      };
    });

    return NextResponse.json({ success: true, data: enrichedResults, lastUpdated });

  } catch (error: any) {
    console.error("[Bursa Daily Picks] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch daily picks" }, { status: 500 });
  }
}
