import { NextResponse } from 'next/server';
import { getAllMenus, formatHebrewDate } from '@/lib/menus';
import { kvMGet, kvGetStr } from '@/lib/kv';
import { lastDays } from '@/lib/day';

export const dynamic = 'force-dynamic';

// מושך קליקים מ-Bitly API עבור קישור bit.ly — מחזיר 0 בכישלון / אין טוקן
async function fetchBitlyClicks(url: string): Promise<number> {
  const token = process.env.BITLY_TOKEN;
  if (!token) return 0;
  const m = url.match(/bit\.ly\/([^\s/?#]+)/i);
  if (!m) return 0;
  const id = `bit.ly/${m[1]}`; // אסור לקודד את ה-/ — Bitly API מצפה לנתיב רגיל
  try {
    const r = await fetch(
      `https://api-ssl.bitly.com/v4/bitlinks/${id}/clicks/summary?unit=day&units=-1`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } }
    );
    const d = await r.json();
    console.log('[bitly]', id, r.status, JSON.stringify(d).slice(0, 120));
    if (!r.ok) return 0;
    return Number(d.total_clicks) || 0;
  } catch (e) { console.log('[bitly-err]', id, String(e)); return 0; }
}

// מחזיר סטטיסטיקות לכל התפריטים + קליקי bit.ly לתפריטים ישנים (ללא מעקב Yummio)
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const menus = getAllMenus();
  const keys: string[] = [];
  for (const m of menus) {
    keys.push(`v:${m.slug}`, `sc:${m.slug}`);
    m.recipes.forEach((_, i) => keys.push(`c:${m.slug}:${i}:wa`, `c:${m.slug}:${i}:page`));
  }

  // איסוף כל קישורי bit.ly מראש
  const bitlyJobs: { slug: string; idx: number; url: string }[] = [];
  for (const m of menus) {
    m.recipes.forEach((r, i) => {
      if (/bit\.ly\//i.test(r.url)) bitlyJobs.push({ slug: m.slug, idx: i, url: r.url });
    });
  }

  // שתי שליפות במקביל: KV + Bitly
  const [vals, lasts, bitlyResults] = await Promise.all([
    kvMGet(keys),
    Promise.all(menus.map((m) => kvGetStr(`sl:${m.slug}`))),
    Promise.allSettled(bitlyJobs.map((j) => fetchBitlyClicks(j.url))),
  ]);

  // מפה: "slug:idx" → קליקי bit.ly
  const bitlyMap: Record<string, number> = {};
  bitlyJobs.forEach((j, i) => {
    bitlyMap[`${j.slug}:${j.idx}`] = bitlyResults[i].status === 'fulfilled' ? bitlyResults[i].value : 0;
  });

  let p = 0;
  const out = menus.map((m, mi) => {
    const views = vals[p++] || 0;
    const sends = vals[p++] || 0;
    const recipes = m.recipes.map((r, i) => {
      const wa = vals[p++] || 0;
      const page = vals[p++] || 0;
      // bit.ly קליקים: רק כשאין מעקב Yummio (תפריט ישן)
      const bitly = (wa === 0 && page === 0) ? (bitlyMap[`${m.slug}:${i}`] || 0) : 0;
      return { i, title: r.title, wa, page, bitly, total: wa + page + bitly };
    });
    const waTotal = recipes.reduce((s, x) => s + x.wa, 0);
    const pageTotal = recipes.reduce((s, x) => s + x.page, 0);
    const bitlyTotal = recipes.reduce((s, x) => s + (x.bitly || 0), 0);
    const clicks = waTotal + pageTotal + bitlyTotal; // סה"כ לתצוגה (כולל bit.ly לתפריטים ישנים)
    return {
      slug: m.slug,
      title: m.title || m.slug,
      dateLabel: formatHebrewDate(m.date),
      message: m.message,
      draft: m.draft === true,
      waText: m.waText || '',
      views,
      waTotal,
      pageTotal,
      bitlyTotal,
      clicks,
      ctr: views ? Math.round(((waTotal + pageTotal) / views) * 100) : 0,
      sends,
      lastSent: lasts[mi],
      recipes,
    };
  });

  // מגמה יומית ל-14 הימים האחרונים
  const days = lastDays(14);
  const trendKeys = [...days.map((d) => `dc:${d}`), ...days.map((d) => `dv:${d}`)];
  const tv = await kvMGet(trendKeys);
  const trend = days.map((d, i) => ({
    date: d,
    clicks: tv[i] || 0,
    views: tv[days.length + i] || 0,
  }));

  return NextResponse.json({ menus: out, trend, kv: vals.some((v) => v > 0) });
}
