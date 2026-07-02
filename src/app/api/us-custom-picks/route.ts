import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

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
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, {
          headers: {
            "User-Agent": "Mozilla/5.0 TradeNetMY/1.0",
            "Accept": "application/json"
          },
          cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (data?.chart?.result?.[0]) {
          const result = data.chart.result[0];
          const highs = result.indicators?.quote?.[0]?.high || [];
          const validHighs = highs.filter((h: any) => h !== null);
          const highest5D = validHighs.length > 0 ? Math.max(...validHighs) : result.meta.regularMarketPrice;
          
          return { 
            symbol: sym, 
            price: result.meta.regularMarketPrice,
            highestPrice: highest5D
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
        quoteMap[res.symbol] = res;
      }
    }

    // Merge live price with static DB data
    const finalData = results.map((row: any) => {
      const liveData = quoteMap[row.symbol];
      return {
        id: row.id,
        ticker: row.symbol,
        name: row.company_name,
        price: liveData ? liveData.price.toFixed(2) : row.price,
        highestPrice: liveData ? liveData.highestPrice.toFixed(2) : row.highest_price,
        score: row.score,
        staticSL: row.static_sl,
        staticSLColor: row.static_sl_color,
        staticTP1: row.static_tp1,
        staticTP1Color: row.static_tp1_color,
        staticTP2: row.static_tp2,
        staticTP2Color: row.static_tp2_color,
        staticTP3: row.static_tp3,
        staticTP3Color: row.static_tp3_color,
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
    const { ticker, name, price, score, highestPrice, staticSL, staticSLColor, staticTP1, staticTP1Color, staticTP2, staticTP2Color, staticTP3, staticTP3Color } = body;

    if (!ticker || !name) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const dateStr = new Date().toISOString();

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
