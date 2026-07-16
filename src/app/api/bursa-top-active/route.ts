import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  try {
    let cookieString = '';
    try {
      const body = await req.json();
      cookieString = body?.cookieString || '';
    } catch (e) {
      // Body might be empty or invalid, ignore
    }

    const url = 'https://www.isaham.my/screener/v2/api/top-active';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.isaham.my/screener/top-active',
      'Origin': 'https://www.isaham.my'
    };

    if (cookieString.trim()) {
      headers['Cookie'] = cookieString.trim();
    }

    // Fetch top active stocks from iSaham via urlencoded POST
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

    const rawList = data.data;
    const cleanedList: CleanItem[] = [];

    for (const item of rawList) {
      // 1. Extract numeric rank from sort_order (e.g., "<small class=\"text-secondary\">1</small>")
      const rankMatch = item.sort_order.match(/>(\d+)</);
      const rank = rankMatch ? parseInt(rankMatch[1], 10) : 0;

      // 2. Extract symbol and name from s_symbol
      // Example: "<a class=\"stock_link\" href=\"/stock/tanco\"><div class=\"d-flex flex-row align-items-center\">...<div>TANCO</div><small...>TANCO HOLDINGS BHD</small>...</a>"
      const symbolMatch = item.s_symbol.match(/<div><div>([A-Z0-9&._-]+)<\/div>/i);
      const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : '';

      const nameMatch = item.s_symbol.match(/<small[^>]*>([^<]+)<\/small>/);
      const name = nameMatch ? nameMatch[1].trim() : '';

      // Ignore items without symbol
      if (!symbol) continue;

      // 3. Last Price lp1
      const price = parseFloat(item.lp1) || 0;

      // 4. Change % perf_1d
      const change = parseFloat(item.perf_1d) || 0;

      // 5. Volume
      const volume = parseInt(item.volume, 10) || 0;

      // 6. Market Cap
      const marketCap = parseInt(item.market_cap, 10) || 0;

      // 7. Parse iSaham Score (total_score)
      let isahamScore = 0;
      if (typeof item.total_score === 'number') {
        isahamScore = item.total_score;
      } else if (typeof item.total_score === 'string') {
        isahamScore = parseFloat(item.total_score) || 0;
      }

      // 8. Parse LTS Score (lts_score)
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

    // If scores are unlocked, sort the entire list by iSaham Score descending
    const hasUnlockedScores = cleanedList.some(item => item.isahamScore > 0);
    if (hasUnlockedScores) {
      cleanedList.sort((a, b) => b.isahamScore - a.isahamScore);
    }

    return NextResponse.json({
      success: true,
      count: cleanedList.length,
      hasUnlockedScores,
      results: cleanedList
    });

  } catch (error: any) {
    console.error('[Bursa Top Active] API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error: ' + error.message },
      { status: 500 }
    );
  }
}
