import { NextResponse } from 'next/server';
import { kvIncr, kvSet, kvGetStr } from '@/lib/kv';
import { ilDay } from '@/lib/day';
import { getMenu } from '@/lib/menus';

/** חתימה קצרה לטקסט — כדי לזהות אם הפתיח שונה בין שליחה לשליחה */
function hashText(t: string): string {
  const s = (t || '').replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export const dynamic = 'force-dynamic';

// מסמן תפריט כ"נשלח": מגדיל מונה, שומר תאריך אחרון, ומוסיף לרשימת השליחות.
// רשימת השליחות (sends:<slug>) היא הבסיס להפרדה בין שליחה מקורית לבין repost:
// כל שליחה פותחת "חלון" חדש, והקליקים היומיים משויכים לחלון שבו נספרו.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let slug = '';
  let note = '';
  let dateOverride = '';
  try {
    const b = await req.json();
    slug = b.slug || '';
    note = String(b.note || '').slice(0, 80);   // למשל: "repost", "קבוצות חדשות"
    dateOverride = String(b.date || '').trim();  // לרישום שליחה מהעבר: YYYY-MM-DD
  } catch { /* */ }
  if (!slug) return NextResponse.json({ error: 'no slug' }, { status: 400 });

  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateOverride) ? dateOverride : ilDay();

  // רשימת השליחות — מיון עולה, בלי כפילויות באותו יום
  // בצמת הפתיח הנוכחי — כך נדע אם השליחה החוזרת הייתה עם טקסט ששונה
  const menu = getMenu(slug);
  const h = hashText([menu?.title, menu?.intro].filter(Boolean).join('\n'));

  let sends: { d: string; note?: string; h?: string }[] = [];
  try { sends = JSON.parse((await kvGetStr(`sends:${slug}`)) || '[]'); } catch { sends = []; }
  if (!sends.some((s) => s.d === day)) {
    sends.push({ d: day, h, ...(note ? { note } : {}) });
    sends.sort((a, b) => a.d.localeCompare(b.d));
    await kvSet(`sends:${slug}`, JSON.stringify(sends));
  }

  const count = await kvIncr(`sc:${slug}`);
  await kvSet(`sl:${slug}`, day);
  return NextResponse.json({ ok: true, count, sends });
}

// מחזיר את יומן השליחות של תפריט
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug') || '';
  if (!slug) return NextResponse.json({ error: 'no slug' }, { status: 400 });
  let sends: { d: string; note?: string; h?: string }[] = [];
  try { sends = JSON.parse((await kvGetStr(`sends:${slug}`)) || '[]'); } catch { /* */ }
  return NextResponse.json({ slug, sends });
}
