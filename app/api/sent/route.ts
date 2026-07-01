import { NextResponse } from 'next/server';
import { kvIncr, kvSet } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// מסמן תפריט כ"נשלח": מגדיל מונה שליחות ושומר תאריך אחרון. מוגן בסיסמה.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let slug = '';
  try { slug = (await req.json()).slug || ''; } catch { /* */ }
  if (!slug) return NextResponse.json({ error: 'no slug' }, { status: 400 });

  const count = await kvIncr(`sc:${slug}`);
  await kvSet(`sl:${slug}`, new Date().toISOString().slice(0, 10));
  return NextResponse.json({ ok: true, count });
}
