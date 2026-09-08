import { NextResponse } from 'next/server';
import { kvBulkImport, kvGetStr, kvSet } from '@/lib/kv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// העברת ההיסטוריה מ-Upstash ל-Turso — עמידה בפני הפסקות וניתנת להרצה חוזרת.
// עובדת במנות: כל קריאה מעבדת חלק, שומרת סמן (cursor), ואפשר לקרוא שוב עד שמסתיים.
// מוגנת מעצמה: לא כותבת כלום חוץ מהעתקת נתונים משלנו, ונעצרת לבד כשסיימה.

const U_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const U_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const CURSOR_KEY = 'migrate:cursor';
const DONE_KEY = 'migrate:done';
const STATS_KEY = 'migrate:stats';

async function upstash(cmd: unknown[]): Promise<unknown> {
  const r = await fetch(U_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${U_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`upstash ${r.status}: ${text.slice(0, 180)}`);
  try { return JSON.parse(text)?.result; } catch { throw new Error(`upstash bad json: ${text.slice(0, 120)}`); }
}

async function runBatch() {
  if (!U_URL || !U_TOKEN) {
    return { ok: false, error: 'Upstash env vars missing — add KV_REST_API_URL + KV_REST_API_TOKEN in Vercel' };
  }

  const done = await kvGetStr(DONE_KEY);
  if (done) {
    const s = await kvGetStr(STATS_KEY);
    return { ok: true, done: true, message: 'already migrated', totals: s ? JSON.parse(s) : null };
  }

  let cursor = (await kvGetStr(CURSOR_KEY)) || '0';
  const totals = JSON.parse((await kvGetStr(STATS_KEY)) || '{"counters":0,"strings":0,"scanned":0}');

  const started = Date.now();
  let batches = 0;

  try {
    // ממשיכים כל עוד יש זמן (משאירים מרווח ביטחון של 15 שניות)
    while (Date.now() - started < 42_000) {
      const res = (await upstash(['SCAN', cursor, 'COUNT', '400'])) as [string, string[]];
      const next = String(res?.[0] ?? '0');
      const keys = (res?.[1] || []).filter(Boolean);
      totals.scanned += keys.length;
      batches++;

      // MGET במנות של 100 — הרבה פחות פקודות מ-TYPE+GET לכל מפתח
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100);
        const vals = (await upstash(['MGET', ...chunk])) as (string | null)[];
        const counters: [string, number][] = [];
        const strings: [string, string][] = [];
        chunk.forEach((k, j) => {
          const v = vals?.[j];
          if (v == null) return;                       // לא string (hash/set) — מדלגים
          const s = String(v).trim();
          if (/^\d+$/.test(s)) { const n = Number(s); if (n > 0) counters.push([k, n]); }
          else strings.push([k, String(v)]);
        });
        if (await kvBulkImport(counters, strings)) {
          totals.counters += counters.length;
          totals.strings += strings.length;
        }
      }

      cursor = next;
      await kvSet(CURSOR_KEY, cursor);
      await kvSet(STATS_KEY, JSON.stringify(totals));

      if (cursor === '0') {
        await kvSet(DONE_KEY, new Date().toISOString());
        return { ok: true, done: true, totals, batches };
      }
    }
  } catch (e) {
    await kvSet(STATS_KEY, JSON.stringify(totals));
    return { ok: false, done: false, error: String(e), totals, cursor, hint: 'קרא שוב כדי להמשיך מאותה נקודה' };
  }

  return { ok: true, done: false, totals, cursor, batches, hint: 'לא הסתיים — קרא שוב כדי להמשיך' };
}

// GET — בטוח: רק מעתיק נתונים משלנו, ונעצר לבד כשסיים. אפשר לקרוא שוב ושוב.
export async function GET() {
  return NextResponse.json(await runBatch());
}

// POST — עם סיסמת אדמין (הכפתור בממשק)
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const r = await runBatch();
  return NextResponse.json({ ...r, report: { scanned: r.totals?.scanned || 0, counters: r.totals?.counters || 0, strings: r.totals?.strings || 0, skipped: 0, errors: r.error ? [r.error] : [] } });
}
