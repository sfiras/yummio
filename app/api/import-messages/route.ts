import { NextResponse } from 'next/server';
import { putFile, getFileRaw } from '@/lib/github';
import { kvSet, kvGetStr, kvSetNum } from '@/lib/kv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ייבוא הודעות וואטסאפ היסטוריות אל תוך המערכת כתפריטים.
// מקבל הודעות גולמיות (טקסט כפי שנשלח), מפרק אותן, פותח קישורי bit.ly,
// מושך כותרת/תמונה מכל עמוד מתכון, ובונה קובץ תפריט.
//
// הערה חשובה: הקישורים המקוריים נשמרים כמו שהם (bit.ly) בשדה sent,
// כי הקליקים ההיסטוריים נספרו אצל Bitly — לא אצלנו. כך הסטטיסטיקה נשארת אמיתית.

type Parsed = {
  title: string;
  intro: string;
  items: { n: number; title: string; desc: string; link: string }[];
  menuLink: string;
};

const LINK_RE = /https?:\/\/[^\s)\]<>"]+/g;
const NUM_RE = /^(?:[0-9]️?⃣|\u{1F51F}|\d{1,2}[.)])\s*/u;

/** מפרק הודעת וואטסאפ למבנה: כותרת, פתיח, ורשימת מתכונים ממוספרים */
function parseMessage(body: string): Parsed {
  const lines = body.replace(/\r/g, '').split('\n');
  const items: Parsed['items'] = [];
  let menuLink = '';
  const head: string[] = [];

  let cur: { n: number; title: string; desc: string; link: string } | null = null;
  let seenItem = false;

  for (const raw of lines) {
    const line = raw.trim();
    const isNum = NUM_RE.test(line);
    const urls = line.match(LINK_RE) || [];

    if (isNum) {
      if (cur) items.push(cur);
      seenItem = true;
      const t = line.replace(NUM_RE, '').replace(/\*/g, '').trim();
      cur = { n: items.length + 1, title: t, desc: '', link: '' };
      continue;
    }
    if (urls.length) {
      const u = String(urls[0] || '').replace(/[.,;:!?*]+$/, '');
      if (cur && !cur.link) cur.link = u;
      else if (!seenItem && !menuLink) menuLink = u;  // קישור התפריט המלא
      continue;
    }
    if (!line) continue;
    if (cur) { if (!cur.desc) cur.desc = line.replace(/\*/g, '').trim(); }
    else head.push(line.replace(/\*/g, '').trim());
  }
  if (cur) items.push(cur);

  // הפתיח: השורות שלפני המתכון הראשון, בלי שורות שירות
  const clean = head.filter((l) =>
    !/^אם קישור לא נפתח/.test(l) &&
    !/לצפייה בתפריט המלא/.test(l) &&
    !/^לכל המתכונים/.test(l)
  );
  return {
    title: clean[0] || '',
    intro: clean.slice(1).join('\n').trim(),
    items,
    menuLink,
  };
}

/** פותח קישור מקוצר ומושך ממנו כותרת/תמונה/מחבר */
async function resolve(link: string, origin: string): Promise<{ url: string; title: string; image: string; author: string }> {
  try {
    const r = await fetch(`${origin}/api/scrape?url=${encodeURIComponent(link)}`, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d?.url || d?.title) {
        return { url: d.url || link, title: d.title || '', image: d.image || '', author: d.author || '' };
      }
    }
  } catch { /* ממשיכים עם מה שיש */ }
  return { url: link, title: '', image: '', author: '' };
}

export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let messages: { date: string; time?: string; body: string }[] = [];
  let dryRun = false;
  try {
    const b = await req.json();
    messages = Array.isArray(b.messages) ? b.messages : [];
    dryRun = !!b.dryRun;
  } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  if (messages.length === 0) return NextResponse.json({ error: 'no messages' }, { status: 400 });
  if (messages.length > 6) return NextResponse.json({ error: 'עד 6 הודעות בכל קריאה (מגבלת זמן)' }, { status: 400 });

  const origin = new URL(req.url).origin;
  const created: string[] = [];
  const skipped: { slug: string; why: string }[] = [];
  const failed: { date: string; why: string }[] = [];

  for (const msg of messages) {
    try {
      const p = parseMessage(msg.body);
      if (p.items.length < 2) { failed.push({ date: msg.date, why: 'לא נמצאו מתכונים' }); continue; }

      // מספר ההודעה באותו יום — התא הפנוי הראשון
      let n = 1, slug = '';
      for (; n <= 9; n++) {
        slug = `${msg.date}-${n}`;
        if (!(await getFileRaw(`data/menus/${slug}.json`))) break;
      }
      if (n > 9) { skipped.push({ slug: `${msg.date}-?`, why: 'כל המקומות תפוסים' }); continue; }

      // פותחים את כל הקישורים במקביל
      const resolved = await Promise.all(p.items.map((it) => resolve(it.link, origin)));

      const recipes = p.items.map((it, i) => ({
        image: resolved[i].image,
        title: it.title || resolved[i].title,
        desc: it.desc,
        url: resolved[i].url,
        sent: it.link,               // הקישור המקוצר ששלחנו בפועל (לסטטיסטיקת Bitly)
        time: '',
        level: '',
        author: resolved[i].author,
      }));

      const menu = {
        date: msg.date,
        message: n,
        title: p.title,
        intro: p.intro,
        image: recipes.find((r) => r.image)?.image || '',
        tracked: false,              // היסטורי: הקליקים נספרו ב-Bitly, לא אצלנו
        imported: true,              // סימון שזה יובא מהיסטוריית וואטסאפ
        draft: false,
        waText: msg.body,
        recipes,
      };

      if (!dryRun) {
        await putFile(`data/menus/${slug}.json`, JSON.stringify(menu, null, 2) + '\n',
          `import: ${slug} from WhatsApp history`);
        // רישום השליחה
        let sends: { d: string; note?: string }[] = [];
        try { sends = JSON.parse((await kvGetStr(`sends:${slug}`)) || '[]'); } catch { /* */ }
        if (!sends.some((s) => s.d === msg.date)) {
          sends.push({ d: msg.date, note: 'מיובא מוואטסאפ' });
          sends.sort((a, b) => a.d.localeCompare(b.d));
          await kvSet(`sends:${slug}`, JSON.stringify(sends));
          await kvSetNum(`sc:${slug}`, sends.length);
          await kvSet(`sl:${slug}`, sends[sends.length - 1].d);
        }
      }
      created.push(slug);
    } catch (e) {
      failed.push({ date: msg.date, why: String(e).slice(0, 100) });
    }
  }

  return NextResponse.json({ ok: true, dryRun, created, skipped, failed });
}
