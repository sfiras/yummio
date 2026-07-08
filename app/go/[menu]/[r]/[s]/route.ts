import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menus';
import { kvIncr } from '@/lib/kv';
import { ilDay } from '@/lib/day';
import { isBot } from '@/lib/bots';

export const dynamic = 'force-dynamic';

// מפנה ללחיצה על מתכון, סופר את הקליק (מקור wa=וואטסאפ / page=עמוד), ומוסיף UTM ליעד.
// /go/<menu>/<recipeIndex>/<wa|page>
export async function GET(
  req: Request,
  { params }: { params: { menu: string; r: string; s: string } }
) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://yummio.vercel.app';
  const menu = getMenu(params.menu);
  const idx = Number(params.r);
  const recipe = menu?.recipes?.[idx];
  if (!recipe || !recipe.url) return NextResponse.redirect(site, 302);

  const src = params.s === 'wa' ? 'wa' : 'page';
  // סופרים את הקליק רק אם זה לא בוט/סורק (וואטסאפ/פייסבוק וכו') — כדי לא לזהם נתונים
  if (!isBot(req.headers.get('user-agent'))) {
    const day = ilDay();
    await Promise.all([
      kvIncr(`c:${params.menu}:${idx}:${src}`),
      kvIncr(`dc:${day}`),
      kvIncr(`mc:${params.menu}:${day}`),
    ]);
  }

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
