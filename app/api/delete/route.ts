import { NextResponse } from 'next/server';
import { deleteFile } from '@/lib/github';

export const dynamic = 'force-dynamic';

// מחיקת תפריט לגמרי: מוחק את קובץ ה-JSON מהמאגר. מוגן בסיסמה.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let slug = '';
  try { slug = (await req.json()).slug || ''; } catch { /* */ }
  // מוודאים שם קובץ בטוח (רק אותיות/ספרות/מקף)
  if (!slug || !/^[a-zA-Z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'bad slug' }, { status: 400 });
  }
  try {
    await deleteFile(`data/menus/${slug}.json`, `admin: delete ${slug}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
