import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

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
    return NextResponse.json({ 
      success: true, 
      tickers: JSON.parse((row.tickers_json as string) || '[]'),
      results: JSON.parse((row.results_json as string) || '[]')
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
