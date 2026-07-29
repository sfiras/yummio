import { NextResponse } from 'next/server';
import { kvIncr } from '@/lib/kv';
import { ilDay } from '@/lib/day';
import { isBot } from '@/lib/bots';

export const dynamic = 'force-dynamic';

// מסווג את מקור הצפייה לפי ה-referrer שנשלח מהדפדפן
// ריק => כניסה ישירה (וואטסאפ ברוב המקרים) · הדומיין שלנו => ניווט פנימי · אחרת => חיצוני
function classifyView(ref: string): 'wa' | 'internal' | 'other' {
  const s = (ref || '').trim();
  if (!s) return 'wa';
  try {
    const host = new URL(s).host.toLowerCase();
    if (host.endsWith('yummio.co.il') || host.endsWith('yummio.vercel.app')) return 'internal';
    if (host.includes('whatsapp')) return 'wa';
    return 'other';
  } catch { return 'wa'; }
}

// משואה לספירת צפיות בעמוד תפריט: /api/view?m=<slug>&r=<referrer>
export async function GET(req: Request) {
  const u = new URL(req.url);
  const m = u.searchParams.get('m');
  if (m && !isBot(req.headers.get('user-agent'))) {
    const src = classifyView(u.searchParams.get('r') || '');
    await Promise.all([
      kvIncr(`v:${m}`),
      kvIncr(`vs:${m}:${src}`),
      kvIncr(`dv:${ilDay()}`),
    ]);
  }
  return new NextResponse(null, { status: 204 });
}
