import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// מאמת את סיסמת הניהול
export async function POST(req: Request) {
  const pass = req.headers.get('x-admin-pass');
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not set' }, { status: 500 });
  }
  if (pass !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
