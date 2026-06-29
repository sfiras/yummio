import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function meta(html: string, prop: string): string {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1].trim()) : '';
}

/** מושך og:image / og:title / og:description מעמוד מתכון (כולל מעקב אחרי קישורי bit.ly) */
export async function GET(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url).searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YummioBot/1.0)' },
      redirect: 'follow',
      cache: 'no-store',
    });
    const html = await res.text();
    const title =
      meta(html, 'og:title') ||
      decodeEntities((html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim());
    const image = meta(html, 'og:image') || meta(html, 'twitter:image');
    const desc = meta(html, 'og:description') || meta(html, 'description');
    return NextResponse.json({ title, image, desc, finalUrl: res.url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
