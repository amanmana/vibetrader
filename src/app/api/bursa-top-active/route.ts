import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface CleanItem {
  rank: number;
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
  isahamScore: number;
  ltsScore: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const screener = searchParams.get('screener') || 'top-active';
    const allowedScreeners = ['top-active', 'jerung-x', 'isaham-super-short-term'];
    const activeScreener = allowedScreeners.includes(screener) ? screener : 'top-active';

    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;

    // 1. Get cached data from D1 if available
    let savedScreenerData: CleanItem[] | null = null;
    let savedUpdatedAt: string | null = null;
    if (db) {
      try {
        const row = await db.prepare('SELECT value, updated_at FROM system_settings WHERE key = ?')
          .bind(`isaham_screener_${activeScreener}`)
          .first();
        if (row && row.value) {
          savedScreenerData = JSON.parse(row.value as string);
          savedUpdatedAt = row.updated_at as string;
          
          if (Array.isArray(savedScreenerData)) {
            // Sort by rank ascending to preserve the default iSaham website order
            savedScreenerData.sort((a, b) => a.rank - b.rank);
          }
        }
      } catch (e) {
        console.warn('[Bursa Top Active] Failed to read cached screener from D1:', e);
      }
    }

    let cookieString = '';
    
    // Retrieve cookie from D1 system_settings for live fetch
    if (db) {
      try {
        const setting = await db.prepare('SELECT value FROM system_settings WHERE key = ?').bind('isaham_cookie').first();
        cookieString = setting ? (setting.value as string) : '';
      } catch (e) {
        console.warn('[Bursa Top Active] Failed to read cookie from D1:', e);
      }
    }

    const url = `https://www.isaham.my/screener/v2/api/${activeScreener}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://www.isaham.my/screener/${activeScreener}`,
      'Origin': 'https://www.isaham.my'
    };

    if (cookieString.trim()) {
      headers['Cookie'] = cookieString.trim();
    }

    let liveFetchError: string | null = null;
    let rawList: any[] = [];

    try {
      // Fetch stocks from iSaham via urlencoded POST
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: 'market=klse'
      });

      if (!res.ok) {
        throw new Error(`iSaham responded with status: ${res.status}`);
      }

      const data: any = await res.json();
      if (data.status !== 'success' || !Array.isArray(data.data)) {
        throw new Error(data.message || 'Failed to fetch data from iSaham');
      }

      rawList = data.data;
    } catch (err: any) {
      liveFetchError = err.message || 'Failed to fetch';
    }

    // If live fetch fails, fallback to saved data
    if (liveFetchError) {
      if (savedScreenerData) {
        return NextResponse.json({
          success: true,
          count: savedScreenerData.length,
          hasUnlockedScores: savedScreenerData.some(item => item.isahamScore > 0),
          results: savedScreenerData,
          isFallback: true,
          updatedAt: savedUpdatedAt,
          error: `Live fetch failed (${liveFetchError}). Showing saved data.`
        });
      } else {
        return NextResponse.json(
          { success: false, error: `Screener disekat oleh iSaham (403). Sila gunakan butang Paste manual untuk memuatkan data.` },
          { status: 403 }
        );
      }
    }

    const cleanedList: CleanItem[] = [];

    for (const item of rawList) {
      const rankMatch = item.sort_order.match(/>(\d+)</);
      const rank = rankMatch ? parseInt(rankMatch[1], 10) : 0;

      const symbolMatch = item.s_symbol.match(/<div><div>([A-Z0-9&._-]+)<\/div>/i);
      const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : '';

      const nameMatch = item.s_symbol.match(/<small[^>]*>([^<]+)<\/small>/);
      const name = nameMatch ? nameMatch[1].trim() : '';

      if (!symbol) continue;

      const price = parseFloat(item.lp1) || 0;
      const change = parseFloat(item.perf_1d) || 0;
      const volume = parseInt(item.volume, 10) || 0;
      const marketCap = parseInt(item.market_cap, 10) || 0;

      let isahamScore = 0;
      if (typeof item.total_score === 'number') {
        isahamScore = item.total_score;
      } else if (typeof item.total_score === 'string') {
        isahamScore = parseFloat(item.total_score) || 0;
      }

      let ltsScore = 0;
      if (typeof item.lts_score === 'number') {
        ltsScore = item.lts_score;
      } else if (typeof item.lts_score === 'string') {
        ltsScore = parseFloat(item.lts_score) || 0;
      }

      cleanedList.push({
        rank,
        symbol,
        name,
        price,
        change,
        volume,
        marketCap,
        isahamScore,
        ltsScore
      });
    }

    const hasUnlockedScores = cleanedList.some(item => item.isahamScore > 0);
    // Sort by rank ascending to preserve the default iSaham website order
    cleanedList.sort((a, b) => a.rank - b.rank);

    // Save/Update the cache in D1
    if (db && cleanedList.length > 0) {
      try {
        await db.prepare(`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET 
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        `).bind(`isaham_screener_${activeScreener}`, JSON.stringify(cleanedList)).run();
        
        // Retrieve the newly created updated_at timestamp
        const updatedRow = await db.prepare('SELECT updated_at FROM system_settings WHERE key = ?')
          .bind(`isaham_screener_${activeScreener}`)
          .first();
        if (updatedRow) {
          savedUpdatedAt = updatedRow.updated_at as string;
        }
      } catch (e) {
        console.warn('[Bursa Top Active] Failed to cache screener to D1:', e);
      }
    }

    return NextResponse.json({
      success: true,
      count: cleanedList.length,
      hasUnlockedScores,
      results: cleanedList,
      isFallback: false,
      updatedAt: savedUpdatedAt || new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Bursa Top Active] API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { screener, results } = await req.json();

    if (!screener || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Missing screener or results array" }, { status: 400 });
    }

    // Sort by rank ascending to preserve the default iSaham website order
    results.sort((a, b) => a.rank - b.rank);

    await db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).bind(`isaham_screener_${screener}`, JSON.stringify(results)).run();

    return NextResponse.json({ success: true, message: "Screener data saved successfully" });
  } catch (error: any) {
    console.error("[Bursa Top Active POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
