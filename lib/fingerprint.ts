import type { Menu } from './menus';

// זיהוי "אותה הודעה" — לפי *קבוצת המתכונים המלאה*, לא לפי מתכון בודד.
//
// למה: לפעמים משנים רק את הפתיח (בגלל היום/החג) והמתכונים זהים — זו אותה הודעה.
// ומצד שני, אותו מתכון בודד מופיע בהרבה הודעות שונות — אז מתכון אחד לא מספיק לזיהוי.
// הפתרון: חתימה מקבוצת כל כתובות המתכונים, ממוינת (סדר לא משנה) ומנורמלת.

/** מנרמל כתובת מתכון: בלי פרוטוקול/www/פרמטרים/סלאש מסיים, ובפענוח אחיד */
export function normUrl(u: string): string {
  if (!u) return '';
  let s = u.trim();
  try { s = decodeURIComponent(s); } catch { /* כבר מפוענח */ }
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
  return s.toLowerCase();
}

/** חתימה יציבה לקבוצת כתובות (סדר לא משנה, כפילויות מתעלמים מהן) */
export function fingerprintUrls(urls: string[]): string {
  const set = Array.from(new Set(urls.map(normUrl).filter(Boolean))).sort();
  if (set.length === 0) return '';
  // FNV-1a — קצר, יציב, בלי תלות בספרייה
  let h = 0x811c9dc5;
  const s = set.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${set.length}-${h.toString(36)}`;
}

/** חתימה של תפריט */
export function fingerprintMenu(m: Pick<Menu, 'recipes'>): string {
  return fingerprintUrls((m.recipes || []).map((r) => r.url));
}

/** כמה דומות שתי קבוצות מתכונים (Jaccard 0..1) — לזיהוי "כמעט אותה הודעה" */
export function similarity(a: string[], b: string[]): number {
  const A = new Set(a.map(normUrl).filter(Boolean));
  const B = new Set(b.map(normUrl).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}

export type DupMatch = {
  slug: string;
  title: string;
  date: string;
  kind: 'exact' | 'near';
  score: number;      // 1 = זהה לגמרי
  shared: number;     // כמה מתכונים משותפים
};

/** מוצא תפריטים קיימים עם אותה קבוצת מתכונים (או כמעט) */
export function findDuplicates(
  urls: string[],
  menus: Menu[],
  opts: { minScore?: number; excludeSlug?: string } = {}
): DupMatch[] {
  const minScore = opts.minScore ?? 0.8;   // 80% חפיפה = "כמעט אותה הודעה"
  const fp = fingerprintUrls(urls);
  const mine = new Set(urls.map(normUrl).filter(Boolean));
  const out: DupMatch[] = [];

  for (const m of menus) {
    if (opts.excludeSlug && m.slug === opts.excludeSlug) continue;
    const theirs = (m.recipes || []).map((r) => r.url);
    const score = similarity(urls, theirs);
    if (score < minScore) continue;
    let shared = 0;
    for (const u of theirs) if (mine.has(normUrl(u))) shared++;
    out.push({
      slug: m.slug,
      title: m.title || m.slug,
      date: m.date,
      kind: fingerprintMenu(m) === fp ? 'exact' : 'near',
      score: Math.round(score * 100) / 100,
      shared,
    });
  }
  // זהים לגמרי קודם, ואז לפי דמיון, ואז החדש ביותר
  out.sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'exact' ? -1 : 1) ||
    b.score - a.score ||
    b.date.localeCompare(a.date)
  );
  return out;
}
