import { NextResponse } from 'next/server';
import { kvIncr, kvSet, kvGetStr } from '@/lib/kv';
import { ilDay } from '@/lib/day';

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
  let sends: { d: string; note?: string }[] = [];
  try { sends = JSON.parse((await kvGetStr(`sends:${slug}`)) || '[]'); } catch { sends = []; }
  if (!sends.some((s) => s.d === day)) {
    sends.push({ d: day, ...(note ? { note } : {}) });
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
  let sends: { d: string; note?: string }[] = [];
  try { sends = JSON.parse((await kvGetStr(`sends:${slug}`)) || '[]'); } catch { /* */ }
  return NextResponse.json({ slug, sends });
}
