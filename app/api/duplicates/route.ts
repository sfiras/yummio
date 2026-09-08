import { NextResponse } from 'next/server';
import { getAllMenus } from '@/lib/menus';
import { findDuplicates, fingerprintMenu } from '@/lib/fingerprint';

export const dynamic = 'force-dynamic';

// "האם כבר שלחתי את ההודעה הזאת?"
// מזהה לפי קבוצת המתכונים המלאה — לא לפי מתכון בודד, ולא לפי הפתיח.
// כך שינוי קטן בפתיח לא מבלבל, ומתכון שחוזר בכמה הודעות לא גורם לזיהוי שגוי.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let urls: string[] = [];
  let excludeSlug = '';
  let minScore = 0.8;
  try {
    const b = await req.json();
    urls = Array.isArray(b.urls) ? b.urls : [];
    excludeSlug = b.excludeSlug || '';
    if (typeof b.minScore === 'number') minScore = b.minScore;
  } catch { /* */ }

  if (urls.length === 0) return NextResponse.json({ matches: [], fp: '' });

  const menus = getAllMenus();
  const matches = findDuplicates(urls, menus, { minScore, excludeSlug });
  return NextResponse.json({
    fp: fingerprintMenu({ recipes: urls.map((u) => ({ url: u })) } as never),
    count: urls.length,
    matches: matches.slice(0, 8),
  });
}

// סקירה כללית: כל קבוצות התפריטים שחולקות אותה קבוצת מתכונים
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const menus = getAllMenus();
  const groups: Record<string, { slug: string; title: string; date: string }[]> = {};
  for (const m of menus) {
    const fp = fingerprintMenu(m);
    if (!fp) continue;
    (groups[fp] ||= []).push({ slug: m.slug, title: m.title || m.slug, date: m.date });
  }
  const dups = Object.entries(groups)
    .filter(([, v]) => v.length > 1)
    .map(([fp, v]) => ({ fp, count: v.length, menus: v.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.count - a.count);
  return NextResponse.json({ totalMenus: menus.length, duplicateGroups: dups.length, groups: dups });
}
