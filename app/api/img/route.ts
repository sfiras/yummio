import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// דומיינים מותרים בלבד — פרוקסי תמונות בטוח (מונע SSRF). מאפשר טעינת תמונות מתכון same-origin
// כדי שה-canvas באדמין יוכל לייצא קולאז' בלי CORS taint.
const ALLOWED = [
  'yummio.co.il', 'www.yummio.co.il',
  'metukim.club', 'www.metukim.club',
  'metukimil.co.il', 'www.metukimil.co.il',
];

function hostAllowed(h: string): boolean {
  return ALLOWED.includes(h.toLowerCase());
}

/** פרוקסי תמונות מדומיינים מאושרים בלבד, עם CORS + cache. משמש את מחולל הקולאז'. */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }
  let u: URL;
  try { u = new URL(target); } catch { return NextResponse.json({ error: 'bad url' }, { status: 400 }); }
  if (!hostAllowed(u.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 403 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YummioBot/1.0)' },
      cache: 'no-store', signal: ctrl.signal,
    });
    if (!r.ok) return NextResponse.json({ error: `upstream ${r.status}` }, { status: 502 });
    const ct = r.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return NextResponse.json({ error: 'not an image' }, { status: 415 });
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}
