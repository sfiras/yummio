import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menus';
import { kvGetStr } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// מחזיר את כל נתוני התפריט + הקודים הקצרים (לשכפול/עריכה בלוח). מוגן בסיסמה.
export async function GET(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get('slug');
  const menu = slug ? getMenu(slug) : undefined;
  if (!menu) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // קודים קצרים שנוצרו בפרסום — מאפשרים קישורי /s/xxxxx קצרים גם אחרי רענון
  let codes: string[] = [];
  try {
    const raw = await kvGetStr(`codes:${slug}`);
    if (raw) codes = JSON.parse(raw);
  } catch { /* אין קודים — נשתמש בקישורי /go */ }
  return NextResponse.json({ menu, codes });
}
