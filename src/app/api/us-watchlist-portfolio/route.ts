import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// 1. GET: Retrieve synced watchlist tickers and scan results
export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as any).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const { results } = await db.prepare(`
      SELECT tickers_json, results_json 
      FROM us_watchlist_sync 
      WHERE id = 'default'
    `).all();

    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, tickers: [], results: [] });
    }

    const row = results[0];
    const tickers = JSON.parse((row.tickers_json as string) || '[]');
    let parsedResults = JSON.parse((row.results_json as string) || '[]');

    // Fetch live prices from Yahoo for all tickers in parallel
    if (tickers.length > 0) {
      await Promise.all(
        parsedResults.map(async (resItem: any) => {
          if (!resItem.ticker) return;
          try {
            const yfRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resItem.ticker)}?interval=1d&range=1mo`, {
              headers: {
                "User-Agent": "Mozilla/5.0 TradeNetMY/1.0",
                "Accept": "application/json"
              },
              cache: 'no-store'
            });
            if (yfRes.ok) {
              const data = await yfRes.json() as any;
              const meta = data?.chart?.result?.[0]?.meta;
              if (meta && meta.regularMarketPrice) {
                const livePrice = meta.regularMarketPrice;
                if (!resItem.technical_indicators) {
                  resItem.technical_indicators = {};
                }
                resItem.technical_indicators.current_price = livePrice;
              }
            }
          } catch (e) {
            console.error(`Failed to fetch live price for ${resItem.ticker}`, e);
          }
        })
      );

      // Save the updated results with live prices back to D1
      await db.prepare(`
        REPLACE INTO us_watchlist_sync (id, tickers_json, results_json, updated_at) 
        VALUES ('default', ?, ?, CURRENT_TIMESTAMP)
      `).bind(JSON.stringify(tickers), JSON.stringify(parsedResults)).run();
    }

    return NextResponse.json({ 
      success: true, 
      tickers: tickers,
      results: parsedResults
    });
  } catch (error: any) {
    console.error("GET US Watchlist Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. POST: Overwrite the synced watchlist tickers and scan results
export async function POST(req: NextRequest) {
  try {
    const db = (getRequestContext().env as any).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const body = await req.json();
    const { tickers, results } = body;

    // REPLACE INTO works beautifully for a single-row sync overwrite
    await db.prepare(`
      REPLACE INTO us_watchlist_sync (id, tickers_json, results_json, updated_at)
      VALUES ('default', ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      JSON.stringify(tickers || []), 
      JSON.stringify(results || [])
    )
    .run();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST US Watchlist Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
