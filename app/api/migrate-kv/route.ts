import { NextResponse } from 'next/server';
import { kvSet, kvSetNum } from '@/lib/kv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// העברה חד־פעמית של ההיסטוריה מ-Upstash ל-Turso.
// קורא את כל המפתחות מ-Upstash (SCAN) וכותב אותם ל-Turso.
// בטוח להרצה חוזרת: מדלג על מונים שכבר גדולים או שווים בערכם ב-Turso.
const U_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const U_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function upstash(cmd: unknown[]): Promise<unknown> {
  const r = await fetch(U_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${U_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`upstash ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return j?.result;
}

export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!U_URL || !U_TOKEN) {
    return NextResponse.json({ error: 'Upstash env vars missing — cannot read history' }, { status: 400 });
  }

  const report = { scanned: 0, counters: 0, strings: 0, skipped: 0, errors: [] as string[] };

  try {
    // סריקת כל המפתחות
    let cursor = '0';
    const keys: string[] = [];
    do {
      const res = (await upstash(['SCAN', cursor, 'COUNT', '500'])) as [string, string[]];
      cursor = res?.[0] ?? '0';
      for (const k of res?.[1] || []) keys.push(k);
    } while (cursor !== '0' && keys.length < 20000);
    report.scanned = keys.length;

    for (const key of keys) {
      try {
        const type = (await upstash(['TYPE', key])) as string;
        if (type !== 'string') { report.skipped++; continue; }
        const raw = (await upstash(['GET', key])) as string | null;
        if (raw == null) { report.skipped++; continue; }

        // מונים = ערך מספרי טהור. שאר המפתחות = טקסט (קודים קצרים וכו')
        if (/^\d+$/.test(String(raw).trim())) {
          const n = Number(raw);
          if (n > 0 && (await kvSetNum(key, n))) report.counters++;
          else report.skipped++;
        } else {
          if (await kvSet(key, String(raw))) report.strings++;
          else report.errors.push(`write failed: ${key}`);
        }
      } catch (e) {
        report.errors.push(`${key}: ${String(e).slice(0, 80)}`);
        if (report.errors.length > 20) break;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: String(e), report }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report });
}
