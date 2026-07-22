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
  support?: string;
  remarks?: string;
  strength?: string;
  lot?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const screener = searchParams.get('screener') || 'top-active';
    const allowedScreeners = ['top-active', 'jerung-x', 'isaham-super-short-term'];
    const activeScreener = allowedScreeners.includes(screener) ? screener : 'top-active';

    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;

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

    if (savedScreenerData) {
      return NextResponse.json({
        success: true,
        count: savedScreenerData.length,
        hasUnlockedScores: savedScreenerData.some(item => item.isahamScore > 0),
        results: savedScreenerData,
        isFallback: false,
        updatedAt: savedUpdatedAt
      });
    } else {
      return NextResponse.json({
        success: true,
        count: 0,
        hasUnlockedScores: false,
        results: [],
        isFallback: false,
        updatedAt: null,
        message: "Sila gunakan butang Paste manual untuk memuatkan data kali pertama."
      });
    }

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
