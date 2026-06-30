import { NextResponse } from 'next/server';
import { kvGetStr, kvIncr } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// קישור קצר: /s/<code> -> סופר קליק וואטסאפ ומפנה למתכון (עם UTM)
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://yummio.vercel.app';
  const raw = await kvGetStr(`s:${params.code}`);
  if (!raw) return NextResponse.redirect(site, 302);

  let d: { u: string; m: string; r: number; s: string };
  try { d = JSON.parse(raw); } catch { return NextResponse.redirect(site, 302); }
  if (!d.u) return NextResponse.redirect(site, 302);

  await kvIncr(`c:${d.m}:${d.r}:${d.s || 'wa'}`);

  let target = d.u;
  try {
    const url = new URL(d.u);
    url.searchParams.set('utm_source', d.s === 'page' ? 'landing' : 'whatsapp');
    url.searchParams.set('utm_medium', d.s === 'page' ? 'page' : 'broadcast');
    url.searchParams.set('utm_campaign', d.m);
    url.searchParams.set('utm_content', String(d.r));
    target = url.toString();
  } catch { /* keep as-is */ }
  return NextResponse.redirect(target, 302);
}
