import { NextResponse } from 'next/server';
import { kvIncr, kvMGet, kvHealth } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// בדיקת בריאות למסד הנתונים (Turso). לא חושף סודות — רק סטטוס.
// מגדיל מונה בדיקה וקורא אותו בחזרה: אם המספר עולה בין קריאות — כתיבה+קריאה עובדות.
export async function GET() {
  const h = await kvHealth();
  if (!h.configured) {
    return NextResponse.json({ ok: false, configured: false, reason: 'missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN' });
  }
  const wrote = await kvIncr('health:ping');
  const [readBack] = await kvMGet(['health:ping']);
  const ok = h.ok && wrote > 0 && readBack >= wrote;
  return NextResponse.json({
    ok,
    configured: true,
    write: wrote,
    read: readBack,
    db: 'turso',
  });
}
