import { NextResponse } from 'next/server';
import { kvIncr } from '@/lib/kv';
import { ilDay } from '@/lib/day';

export const dynamic = 'force-dynamic';

// משואה לספירת צפיות בעמוד תפריט: /api/view?m=<slug>
export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get('m');
  if (m) await Promise.all([kvIncr(`v:${m}`), kvIncr(`dv:${ilDay()}`)]);
  return new NextResponse(null, { status: 204 });
}
