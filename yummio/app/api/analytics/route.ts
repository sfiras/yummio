import { NextResponse } from 'next/server';
import { kvMGet } from '@/lib/kv';
import { lastDays } from '@/lib/day';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
          return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

  const N = 180;
    const days = lastDays(N);
    const keys = [...days.map((d) => `dc:${d}`), ...days.map((d) => `dv:${d}`)];
    const vals = await kvMGet(keys);

  const series = days.map((d, i) => ({
        date: d,
        clicks: vals[i] || 0,
        views: vals[days.length + i] || 0,
  }));

  return NextResponse.json({ series });
}
