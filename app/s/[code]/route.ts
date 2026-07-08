import { NextResponse } from 'next/server';
import { kvGetStr, kvIncr } from '@/lib/kv';
import { ilDay } from '@/lib/day';
import { isBot } from '@/lib/bots';

export const dynamic = 'force-dynamic';

// קישור קצר: /s/<code>
//  - קוד של מתכון: סופר קליק לפי מתכון (וואטסאפ/עמוד) ומפנה עם UTM
//  - קוד של קישור עצמאי (מקצר הקישורים): סופר קליק לפי מקור (?s=page => עמוד, ברירת מחדל וואטסאפ)
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://menu.yummio.co.il';
  const raw = await kvGetStr(`s:${params.code}`);
  if (!raw) return NextResponse.redirect(site, 302);

  let d: { u: string; m?: string; r?: number; s?: string; k?: string };
  try { d = JSON.parse(raw); } catch { return NextResponse.redirect(site, 302); }
  if (!d.u) return NextResponse.redirect(site, 302);

  const isRecipe = d.m !== undefined && d.m !== null;
  const qsrc = new URL(req.url).searchParams.get('s') === 'page' ? 'page' : 'wa';
  const src = isRecipe ? (d.s || 'wa') : qsrc;

  if (!isBot(req.headers.get('user-agent'))) {
    const day = ilDay();
    if (isRecipe) {
      await Promise.all([kvIncr(`c:${d.m}:${d.r}:${src}`), kvIncr(`dc:${day}`), kvIncr(`mc:${d.m}:${day}`)]);
    } else {
      await Promise.all([kvIncr(`lc:${params.code}:${src}`), kvIncr(`dc:${day}`)]);
    }
  }

  let target = d.u;
  try {
    const url = new URL(d.u);
    url.searchParams.set('utm_source', src === 'page' ? 'landing' : 'whatsapp');
    url.searchParams.set('utm_medium', src === 'page' ? 'page' : 'broadcast');
    url.searchParams.set('utm_campaign', isRecipe ? String(d.m) : 'link');
    url.searchParams.set('utm_content', isRecipe ? String(d.r) : params.code);
    target = url.toString();
  } catch { /* כתובת לא תקינה — מפנים כמו שהיא */ }
  return NextResponse.redirect(target, 302);
}
