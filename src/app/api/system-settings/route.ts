import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Retrieve setting value from D1
export async function GET(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ success: false, error: "Missing key parameter" }, { status: 400 });
    }

    const setting = await db.prepare('SELECT value FROM system_settings WHERE key = ?').bind(key).first();

    return NextResponse.json({
      success: true,
      key,
      value: setting ? (setting.value as string) : ''
    });

  } catch (error: any) {
    console.error("[System Settings GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Save or Update setting in D1
export async function POST(req: NextRequest) {
  try {
    const db = (getRequestContext().env as unknown as CloudflareEnv).DB;
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { key, value } = await req.json();

    if (!key) {
      return NextResponse.json({ success: false, error: "Missing key in payload" }, { status: 400 });
    }

    // Insert or replace setting
    await db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).bind(key, value || '').run();

    return NextResponse.json({ success: true, key, value });

  } catch (error: any) {
    console.error("[System Settings POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
