import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// Retrieve OCR Picks list from D1
export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" });
    }

    const { results } = await db.prepare(`
      SELECT * FROM ocr_picks 
      ORDER BY created_at ASC
    `).all();

    const mappedResults = (results || []).map((row: any) => ({
      stock_name: row.stock_name,
      last_done: row.last_done,
      target: row.target,
      highest_price: row.highest_price,
      tp2: row.tp2,
      status: row.status
    }));

    return NextResponse.json({ success: true, data: mappedResults });
  } catch (error: any) {
    console.error("[Bursa OCR Picks GET] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch OCR picks" }, { status: 500 });
  }
}

// Save OCR Picks list to D1
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
    
    // Clear old OCR list
    await db.prepare('DELETE FROM ocr_picks').run();
    
    const stmt = db.prepare(`
      INSERT INTO ocr_picks (id, date, stock_name, last_done, target, highest_price, tp2, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = results.map((pick: any) => {
      return stmt.bind(
        pick.stock_name,
        timestamp,
        pick.stock_name,
        pick.last_done || "",
        pick.target || "",
        pick.highest_price || "",
        pick.tp2 || "",
        pick.status || ""
      );
    });

    if (batch.length > 0) {
      await db.batch(batch);
      console.log(`[Bursa OCR Picks] Saved ${batch.length} picks to D1 at ${timestamp}`);
    }

    return NextResponse.json({ success: true, count: batch.length });
  } catch (error: any) {
    console.error("[Bursa OCR Picks POST] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save OCR picks" }, { status: 500 });
  }
}

// Clear OCR Picks list in D1
export async function DELETE(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    await db.prepare('DELETE FROM ocr_picks').run();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Bursa OCR Picks DELETE] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to clear OCR picks" }, { status: 500 });
  }
}
