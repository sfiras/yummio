import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menus';
import { kvIncr } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// מפנה ללחיצה על מתכון, סופר את הקליק (מקור wa=וואטסאפ / page=עמוד), ומוסיף UTM ליעד.
// /go/<menu>/<recipeIndex>/<wa|page>
export async function GET(
  _req: Request,
  { params }: { params: { menu: string; r: string; s: string } }
) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://yummio.vercel.app';
  const menu = getMenu(params.menu);
  const idx = Number(params.r);
  const recipe = menu?.recipes?.[idx];
  if (!recipe || !recipe.url) return NextResponse.redirect(site, 302);

  const src = params.s === 'wa' ? 'wa' : 'page';
  // סופרים את הקליק (מחכים כדי לוודא שנכתב לפני הסגירה)
  await kvIncr(`c:${params.menu}:${idx}:${src}`);

  let target = recipe.url;
  try {
    const dest = new URL(recipe.url);
    dest.searchParams.set('utm_source', src === 'wa' ? 'whatsapp' : 'landing');
    dest.searchParams.set('utm_medium', src === 'wa' ? 'broadcast' : 'page');
    dest.searchParams.set('utm_campaign', params.menu);
    dest.searchParams.set('utm_content', String(idx));
    target = dest.toString();
  } catch {
    /* כתובת לא תקינה — מפנים כמו שהיא */
  }
  return NextResponse.redirect(target, 302);
}
