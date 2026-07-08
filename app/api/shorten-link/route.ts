import { NextResponse } from 'next/server';
import { kvSet, kvGetStr } from '@/lib/kv';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://menu.yummio.co.il';

// מקצר קישורים עצמאי (חלופה ל-bit.ly): מקבל URL + תווית, יוצר קוד קצר ומחזיר קישור מעקב.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: { url?: string; label?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const url = (body.url || '').trim();
  if (!/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: 'קישור לא תקין (חייב להתחיל ב-http/https)' }, { status: 400 });
  }
  const label = (body.label || '').trim().slice(0, 80);

  // קוד ייחודי בן 6 תווים
  let code = '';
  for (let i = 0; i < 6; i++) {
    code = Math.random().toString(36).slice(2, 8);
    const exists = await kvGetStr(`s:${code}`);
    if (!exists) break;
  }

  const ok = await kvSet(`s:${code}`, JSON.stringify({ u: url, t: label, k: 'link' }));
  if (!ok) return NextResponse.json({ error: 'שמירה נכשלה — ודאו ש-KV מחובר.' }, { status: 500 });

  // אינדקס קישורים (מהחדש לישן, מוגבל ל-300)
  try {
    const raw = await kvGetStr('linkindex');
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift({ code, u: url, t: label, ts: Date.now() });
    await kvSet('linkindex', JSON.stringify(arr.slice(0, 300)));
  } catch { /* לא קריטי */ }

  return NextResponse.json({ ok: true, code, short: `${SITE}/s/${code}` });
}
