import { NextResponse } from 'next/server';
import { kvGetStr, kvMGet } from '@/lib/kv';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://menu.yummio.co.il';

// מחזיר את רשימת הקישורים המקוצרים עם ספירת קליקים (וואטסאפ / עמוד / סה״כ). מוגן בסיסמה.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let arr: { code: string; u: string; t: string; ts: number }[] = [];
  try { const raw = await kvGetStr('linkindex'); if (raw) arr = JSON.parse(raw); } catch { /* */ }

  const keys: string[] = [];
  arr.forEach((l) => keys.push(`lc:${l.code}:wa`, `lc:${l.code}:page`));
  const vals = await kvMGet(keys);

  const links = arr.map((l, i) => {
    const wa = vals[i * 2] || 0;
    const page = vals[i * 2 + 1] || 0;
    return { code: l.code, u: l.u, t: l.t, ts: l.ts, short: `${SITE}/s/${l.code}`, wa, page, total: wa + page };
  });

  return NextResponse.json({ links });
}
