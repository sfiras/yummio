import { NextResponse } from 'next/server';
import { putFileBase64 } from '@/lib/github';
import { BP } from '@/lib/base';

export const dynamic = 'force-dynamic';

// שומר תמונת קולאז' (PNG/JPEG כ-dataURL) ל-public/menu-images/<slug>.png בריפו,
// כך היא מוגשת מדומיין המנו עצמו (menu.yummio.co.il/menu-images/...). אין צורך בהרשאה חיצונית.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: { slug?: string; dataUrl?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const slug = (body.slug || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}-\d+$/.test(slug)) {
    return NextResponse.json({ error: 'bad slug' }, { status: 400 });
  }
  const m = (body.dataUrl || '').match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return NextResponse.json({ error: 'bad image' }, { status: 400 });
  const ext = m[1] === 'jpeg' ? 'jpg' : 'png';
  const base64 = m[2];

  if (base64.length > 4000000) return NextResponse.json({ error: 'image too large' }, { status: 413 });

  const path = `public/menu-images/${slug}.${ext}`;
  try {
    await putFileBase64(path, base64, `admin: collage image ${slug}`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: `${BP}/menu-images/${slug}.${ext}` });
}
