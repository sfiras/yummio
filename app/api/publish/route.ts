import { NextResponse } from 'next/server';
import { putFile, getFileRaw } from '@/lib/github';
import { kvSet, kvGetStr } from '@/lib/kv';
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

  // הגנת overwrite: קוראים את הקובץ הקיים פעם אחת (raw) ומשתמשים בו גם ל-409 וגם לגיבוי
  const slug = `${date}-${msgNum}`;
  const menuPath = `data/menus/${slug}.json`;
  const existingRaw = await getFileRaw(menuPath);
  if (existingRaw && !force) {
    let existingTitle = slug;
    try { existingTitle = (JSON.parse(existingRaw) as { title?: string }).title || slug; } catch { /* קובץ פגום — עדיין מזהירים */ }
    return NextResponse.json({ error: 'exists', slug, existingTitle }, { status: 409 });
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

  // גיבוי אוטומטי: אם דורסים תפריט קיים — שומרים עותק ב-archive/ לפני הכתיבה (לא חוסם פרסום אם נכשל)
  if (existingRaw && force) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
      await putFile(`data/menus/archive/${slug}_${ts}.json`, existingRaw, `archive: backup ${slug} before overwrite`);
    } catch (e) {
      console.error('[publish] archive backup failed (continuing):', e);
    }
  }

  try {
    await putFile(menuPath, json, `admin: ${isDraft ? 'draft' : 'publish'} ${slug}`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  // קודים קצרים לקישורי וואטסאפ (רק במצב מעקב)
  let codes: string[] = [];
  if (isTracked) {
    // מייצרים קודים קצרים — ורק אם *כל* הכתיבות הצליחו נשתמש בהם.
    // אם הכתיבה נכשלה (מסד למטה/מכסה) נחזיר [] והלקוח ייפול חזרה ל-/go/ שלא תלוי במסד.
    const made = await Promise.all(clean.map(async (r, i) => {
      const code = Math.random().toString(36).slice(2, 7);
      const ok = await kvSet(`s:${code}`, JSON.stringify({ u: r.url, m: slug, r: i, s: 'wa' }));
      return ok ? code : null;
    }));
    if (made.every((c) => !!c)) {
      // אימות אמיתי: קוראים קוד אחד בחזרה כדי לוודא שהוא באמת נשמר
      const probe = await kvGetStr(`s:${made[0]}`);
      if (probe) {
        codes = made as string[];
        await kvSet(`codes:${slug}`, JSON.stringify(codes));
      } else {
        console.error('[publish] short codes written but not readable — falling back to /go/');
      }
    } else {
      console.error('[publish] short code write failed — falling back to /go/');
    }
  }

  return NextResponse.json({ ok: true, slug, url: `${BP}/menu/${slug}`, codes, draft: isDraft });
}
