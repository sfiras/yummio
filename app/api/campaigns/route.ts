import { NextResponse } from 'next/server';
import { getAllMenus, formatHebrewDate } from '@/lib/menus';
import { kvScanPrefix, kvMGetStr } from '@/lib/kv';
import { ilDay } from '@/lib/day';

export const dynamic = 'force-dynamic';

// מפריד קליקים לפי שליחה — הפתרון ל-repost.
//
// כלל החלון (חשוב):
//   • יש שליחה חוזרת אחריה  -> החלון נסגר ביום השליחה הבאה.
//   • אין שליחה חוזרת       -> החלון נשאר פתוח לנצח וממשיך לספור כרגיל.
// כלומר: הודעה שנשלחה פעם אחת מתנהגת בדיוק כמו קודם — בלי שום קיצוץ.
const addDays = (d: string, n: number) =>
  ilDay(new Date(new Date(d + 'T12:00:00Z').getTime() + n * 86400000));

export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let only = '';
  try { only = (await req.json())?.slug || ''; } catch { /* */ }
  const menus = getAllMenus().filter((m) => !only || m.slug === only);

  const logs = await kvMGetStr(menus.map((m) => `sends:${m.slug}`));

  const out = await Promise.all(menus.map(async (m, mi) => {
    let sends: { d: string; note?: string }[] = [];
    try { sends = JSON.parse(logs[mi] || '[]'); } catch { /* */ }

    // תפריט שנשלח פעם אחת (או בלי רישום) — אין צורך בפירוק כלל.
    // מחזירים אותו כ"קמפיין יחיד פתוח" בלי לגעת בשום מספר.
    const single = sends.length <= 1;

    const daily = single ? {} : await kvScanPrefix(`cd:${m.slug}:`);
    const dailySrc = single ? {} : await kvScanPrefix(`md:${m.slug}:`);

    const byDay: Record<string, { total: number; rec: Record<number, number> }> = {};
    for (const [k, n] of Object.entries(daily)) {
      const p = k.split(':');                       // cd, slug, idx, day
      const idx = Number(p[2]); const day = p[3];
      if (!day || Number.isNaN(idx)) continue;
      byDay[day] ||= { total: 0, rec: {} };
      byDay[day].total += n;
      byDay[day].rec[idx] = (byDay[day].rec[idx] || 0) + n;
    }
    const srcByDay: Record<string, { wa: number; page: number }> = {};
    for (const [k, n] of Object.entries(dailySrc)) {
      const p = k.split(':');                       // md, slug, day, src
      const day = p[2]; const src = p[3];
      if (!day) continue;
      srcByDay[day] ||= { wa: 0, page: 0 };
      if (src === 'wa') srcByDay[day].wa += n; else srcByDay[day].page += n;
    }

    if (sends.length === 0) sends = [{ d: m.date, note: 'משוער (אין רישום שליחה)' }];

    const campaigns = sends.map((s, i) => {
      const next = sends[i + 1]?.d;
      const end = next || '9999-12-31';   // אין שליחה חוזרת => פתוח לנצח, סופר כרגיל
      let clicks = 0, wa = 0, page = 0;
      const rec: Record<number, number> = {};
      const days: { d: string; c: number }[] = [];
      for (const [day, v] of Object.entries(byDay)) {
        if (day < s.d || day >= end) continue;
        clicks += v.total;
        days.push({ d: day, c: v.total });
        for (const [ri, rn] of Object.entries(v.rec)) rec[Number(ri)] = (rec[Number(ri)] || 0) + rn;
      }
      for (const [day, v] of Object.entries(srcByDay)) {
        if (day < s.d || day >= end) continue;
        wa += v.wa; page += v.page;
      }
      days.sort((a, b) => a.d.localeCompare(b.d));
      const top = Object.entries(rec).sort((a, b) => b[1] - a[1])[0];
      return {
        n: i + 1,
        date: s.d,
        dateLabel: formatHebrewDate(s.d),
        note: s.note || (i === 0 ? 'שליחה מקורית' : 'שליחה חוזרת'),
        isRepost: i > 0,
        open: !next,                       // עדיין סופר
        clicks, wa, page,
        // עקומה יומית — 14 ערכים לכל היותר, רק כדי לצייר קו זעיר. לא נתון מרכזי.
        spark: days.slice(-14).map((x) => x.c),
        peak: days.length ? days.reduce((a, b) => (b.c > a.c ? b : a)).d : null,
        recipes: Object.entries(rec)
          .map(([ri, n]) => ({ i: Number(ri), title: m.recipes[Number(ri)]?.title || `#${ri}`, clicks: n }))
          .sort((a, b) => b.clicks - a.clicks),
        top: top ? { title: m.recipes[Number(top[0])]?.title || '', clicks: top[1] } : null,
      };
    });

    const tracked = Object.values(byDay).reduce((s, v) => s + v.total, 0);
    return {
      slug: m.slug,
      title: m.title || m.slug,
      date: m.date,
      dateLabel: formatHebrewDate(m.date),
      sendCount: sends.length,
      single,                       // נשלח פעם אחת — אין פיצול, המספר הכולל תקף
      campaigns,
      tracked,
    };
  }));

  // מציגים קודם את מה שנשלח יותר מפעם אחת (שם ההפרדה חשובה)
  const active = out.filter((x) => x.tracked > 0 || x.sendCount > 1);
  active.sort((a, b) => (b.sendCount - a.sendCount) || b.date.localeCompare(a.date));
  return NextResponse.json({ menus: active });
}
