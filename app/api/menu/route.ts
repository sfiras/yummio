import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menus';
import { kvGetStr, kvSet } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// מחזיר את כל נתוני התפריט + הקודים הקצרים (לשכפול/עריכה בלוח). מוגן בסיסמה.
export async function GET(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get('slug');
  const menu = slug ? getMenu(slug) : undefined;
  if (!menu) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // קודים קצרים (/s/xxxxx). אם עוד לא נוצרו — יוצרים עכשיו, כך שגם תפריטים ישנים מקבלים קישורים קצרים.
  let codes: string[] = [];
  if (menu.tracked !== false) {
    try {
      const raw = await kvGetStr(`codes:${slug}`);
      if (raw) codes = JSON.parse(raw);
    } catch { /* נייצר מחדש */ }

    if (!Array.isArray(codes) || codes.length !== menu.recipes.length) {
      // מייצרים — ורק אם כל הכתיבות הצליחו והקוד באמת נקרא בחזרה, נחזיר אותם.
      const made = await Promise.all(menu.recipes.map(async (r, i) => {
        const code = Math.random().toString(36).slice(2, 7);
        const ok = await kvSet(`s:${code}`, JSON.stringify({ u: r.url, m: slug, r: i, s: 'wa' }));
        return ok ? code : null;
      }));
      const probe = made[0] ? await kvGetStr(`s:${made[0]}`) : null;
      if (made.every((c) => !!c) && probe) {
        codes = made as string[];
        await kvSet(`codes:${slug}`, JSON.stringify(codes));
      } else {
        codes = []; // כשל — הלקוח ייפול חזרה ל-/go/
        console.error('[menu] short code generation failed — client will use /go/');
      }
    }
  }
  return NextResponse.json({ menu, codes });
}
