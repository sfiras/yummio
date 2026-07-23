import { NextResponse } from 'next/server';
import { putFile, getFileJson } from '@/lib/github';
import { kvSet } from '@/lib/kv';
import { BP } from '@/lib/base';

export const dynamic = 'force-dynamic';

type RecipeIn = {
  image?: string; title?: string; desc?: string; url?: string; time?: string; level?: string; author?: string;
};

// מפרסם תפריט: כותב data/menus/<date>-<message>.json ל-GitHub => Vercel פורס אוטומטית
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { date?: string; message?: number | string; title?: string; intro?: string; image?: string; tracked?: boolean; draft?: boolean; waText?: string; recipes?: RecipeIn[]; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const { date, message, title, intro, image, tracked, draft, waText, recipes, force } = body;
  const isTracked = tracked !== false;
  const isDraft = draft === true;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'תאריך לא תקין (YYYY-MM-DD)' }, { status: 400 });
  }
  const msgNum = Number(message || 1);
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return NextResponse.json({ error: 'אין מתכונים' }, { status: 400 });
  }

  // הגנת overwrite: אם הקובץ קיים ו-force לא הועבר — מחזירים 409 עם פרטי התפריט הקיים
  const slug = `${date}-${msgNum}`;
  if (!force) {
    const existing = await getFileJson<{ title?: string }>(`data/menus/${slug}.json`);
    if (existing) {
      return NextResponse.json({ error: 'exists', slug, existingTitle: existing.title || slug }, { status: 409 });
    }
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

  const json =
    JSON.stringify(
      { date, message: msgNum, title: (title || '').trim(), intro: (intro || '').trim(), image: (image || '').trim(), tracked: isTracked, draft: isDraft, waText: (waText || '').trim(), recipes: clean },
      null,
      2
    ) + '\n';

  // Belt-and-suspenders: וידוא JSON תקני לפני כתיבה ל-GitHub
  try { JSON.parse(json); } catch (e) {
    console.error('[publish] invalid JSON output:', e);
    return NextResponse.json({ error: 'שגיאת JSON פנימית — דווח למפתח' }, { status: 500 });
  }

  try {
    await putFile(`data/menus/${slug}.json`, json, `admin: ${isDraft ? 'draft' : 'publish'} ${slug}`);
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

  return NextResponse.json({ ok: true, slug, url: `${BP}/menu/${slug}`, codes, draft: isDraft });
}
