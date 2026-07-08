import { NextResponse } from 'next/server';
import { getAllMenus, formatHebrewDate } from '@/lib/menus';
import { kvMGet, kvGetStr } from '@/lib/kv';
import { lastDays } from '@/lib/day';

export const dynamic = 'force-dynamic';

// מחזיר סטטיסטיקות לכל התפריטים: צפיות בעמוד + קליקים לכל מתכון (וואטסאפ מול עמוד)
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

  const vals = await kvMGet(keys);
  const lasts = await Promise.all(menus.map((m) => kvGetStr(`sl:${m.slug}`)));

  let p = 0;
  const out = menus.map((m, mi) => {
    const views = vals[p++] || 0;
    const sends = vals[p++] || 0;
    const recipes = m.recipes.map((r, i) => {
      const wa = vals[p++] || 0;
      const page = vals[p++] || 0;
      return { i, title: r.title, wa, page, total: wa + page };
    });
    const waTotal = recipes.reduce((s, x) => s + x.wa, 0);
    const pageTotal = recipes.reduce((s, x) => s + x.page, 0);
    const clicks = waTotal + pageTotal;
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
      clicks,
      ctr: views ? Math.round((clicks / views) * 100) : 0,
      sends,
      lastSent: lasts[mi],
      recipes,
    };
  });

  // מגמה יומית ל-14 הימים האחרונים (קליקים + צפיות, כל האתר)
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
