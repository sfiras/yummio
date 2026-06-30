import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, '’');
}

function meta(html: string, prop: string): string {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1].trim()) : '';
}

// מסיר את שם האתר מהכותרת: "מתכון | YUMMIO" => "מתכון"
function cleanTitle(t: string): string {
  return t
    .replace(/\s*[|·–—\-»]\s*(yummio|יאמיו|יומיו)\s*$/i, '')
    .replace(/\s*[|·–—\-»]\s*$/, '')
    .trim();
}

// שם בעל המתכון מתוך JSON-LD (schema.org Recipe.author) או meta author
function extractAuthor(html: string): string {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    let data: unknown;
    try { data = JSON.parse(jsonText); } catch { continue; }
    const root = data as { [k: string]: unknown };
    const nodes: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(root['@graph']) ? (root['@graph'] as unknown[]) : [data];
    for (const node of nodes) {
      const n = node as { [k: string]: unknown };
      if (!n || typeof n !== 'object') continue;
      const type = n['@type'];
      const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
      if (isRecipe && n.author) {
        const a = n.author as { name?: string } | { name?: string }[] | string;
        const name = Array.isArray(a) ? (a[0] && (a[0].name || a[0])) : typeof a === 'string' ? a : a.name;
        if (name) return String(name).trim();
      }
    }
  }
  return meta(html, 'author');
}

/** מושך og:image / כותרת נקייה / תיאור / שם בעל המתכון. עוקב אחרי הפניות (bit.ly) ומחזיר את היעד הסופי. */
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
      redirect: 'follow', cache: 'no-store',
    });
    const html = await res.text();
    const rawTitle = meta(html, 'og:title') || decodeEntities((html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim());
    const title = cleanTitle(rawTitle);
    const image = meta(html, 'og:image') || meta(html, 'twitter:image');
    const desc = meta(html, 'og:description') || meta(html, 'description');
    const author = extractAuthor(html);
    return NextResponse.json({ title, image, desc, author, finalUrl: res.url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
