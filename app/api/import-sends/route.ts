import { NextResponse } from 'next/server';
import { kvSet, kvSetNum, kvMGetStr } from '@/lib/kv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ייבוא יומן שליחות מתוך יצוא צ'אט של וואטסאפ.
// מקבל: { sends: { slug: string[] } }  — לכל תפריט, רשימת תאריכי שליחה (YYYY-MM-DD).
// ממזג עם מה שכבר קיים (בלי כפילויות) ומעדכן את מונה השליחות.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: Record<string, string[]> = {};
  try {
    const b = await req.json();
    payload = b?.sends || {};
  } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const slugs = Object.keys(payload);
  if (slugs.length === 0) return NextResponse.json({ error: 'no sends' }, { status: 400 });

  const existing = await kvMGetStr(slugs.map((s) => `sends:${s}`));
  const report = { menus: 0, added: 0, reposts: 0, skipped: 0 };

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const incoming = (payload[slug] || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (incoming.length === 0) { report.skipped++; continue; }

    let cur: { d: string; note?: string }[] = [];
    try { cur = JSON.parse(existing[i] || '[]'); } catch { cur = []; }
    const have = new Set(cur.map((x) => x.d));

    let added = 0;
    for (const d of incoming) {
      if (have.has(d)) continue;
      have.add(d);
      cur.push({ d, note: 'מיובא מוואטסאפ' });
      added++;
    }
    if (added === 0) { report.skipped++; continue; }

    cur.sort((a, b) => a.d.localeCompare(b.d));
    if (await kvSet(`sends:${slug}`, JSON.stringify(cur))) {
      await kvSetNum(`sc:${slug}`, cur.length);
      await kvSet(`sl:${slug}`, cur[cur.length - 1].d);
      report.menus++;
      report.added += added;
      if (cur.length > 1) report.reposts += cur.length - 1;
    }
  }

  return NextResponse.json({ ok: true, report });
}
