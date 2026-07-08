import { NextResponse } from 'next/server';
import { kvIncr } from '@/lib/kv';
import { ilDay } from '@/lib/day';
import { isBot } from '@/lib/bots';

export const dynamic = 'force-dynamic';

// משואה לספירת צפיות בעמוד תפריט: /api/view?m=<slug>
export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get('m');
  if (m && !isBot(req.headers.get('user-agent'))) {
    await Promise.all([kvIncr(`v:${m}`), kvIncr(`dv:${ilDay()}`)]);
  }
  return new NextResponse(null, { status: 204 });
}
