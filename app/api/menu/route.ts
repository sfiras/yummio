import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menus';

export const dynamic = 'force-dynamic';

// מחזיר את כל נתוני התפריט (לשכפול/עריכה בלוח). מוגן בסיסמה.
export async function GET(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get('slug');
  const menu = slug ? getMenu(slug) : undefined;
  if (!menu) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ menu });
}
