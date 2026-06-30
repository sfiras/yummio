import { NextResponse } from 'next/server';
import { putFile } from '@/lib/github';
import { kvSet } from '@/lib/kv';

export const dynamic = 'force-dynamic';

type RecipeIn = {
  image?: string; title?: string; desc?: string; url?: string; time?: string; level?: string; author?: string;
};

// מפרסם תפריט: כותב data/menus/<date>-<message>.json ל-GitHub => Vercel פורס אוטומטית
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { date?: string; message?: number | string; title?: string; intro?: string; image?: string; tracked?: boolean; recipes?: RecipeIn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const { date, message, title, intro, image, tracked, recipes } = body;
  const isTracked = tracked !== false;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'תאריך לא תקין (YYYY-MM-DD)' }, { status: 400 });
  }
  const msgNum = Number(message || 1);
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return NextResponse.json({ error: 'אין מתכונים' }, { status: 400 });
  }

  const clean = recipes
    .map((r) => ({
      image: (r.image || '').trim(),
      title: (r.title || '').trim(),
      desc: (r.desc || '').trim(),
      url: (r.url || '').trim(),
      time: (r.time || '').trim(),
      level: (r.level || '').trim(),
      author: (r.author || '').trim(),
    }))
    .filter((r) => r.title && r.url);

  if (clean.length === 0) {
    return NextResponse.json({ error: 'כל מתכון צריך לפחות שם וקישור' }, { status: 400 });
  }

  const slug = `${date}-${msgNum}`;
  const json =
    JSON.stringify(
      { date, message: msgNum, title: (title || '').trim(), intro: (intro || '').trim(), image: (image || '').trim(), tracked: isTracked, recipes: clean },
      null,
      2
    ) + '\n';

  try {
    await putFile(`data/menus/${slug}.json`, json, `admin: publish ${slug}`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  // קודים קצרים לקישורי וואטסאפ (רק במצב מעקב)
  let codes: string[] = [];
  if (isTracked) {
    codes = await Promise.all(clean.map(async (r, i) => {
      const code = Math.random().toString(36).slice(2, 7);
      await kvSet(`s:${code}`, JSON.stringify({ u: r.url, m: slug, r: i, s: 'wa' }));
      return code;
    }));
  }

  return NextResponse.json({ ok: true, slug, url: `/menu/${slug}`, codes });
}
