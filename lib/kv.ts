// מונה קליקים/צפיות דרך Vercel KV (Upstash Redis) ב-REST, ללא תלות בחבילה.
// אם משתני הסביבה לא מוגדרים — הכל עובד כרגיל ומחזיר 0 (בטוח לבנייה).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const enabled = () => !!(URL_ && TOKEN);

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

/** מגדיל מונה ב-1 ומחזיר את הערך החדש (0 אם KV כבוי) */
export async function kvIncr(key: string): Promise<number> {
  if (!enabled()) return 0;
  try {
    const r = await fetch(URL_!, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(['INCR', key]),
      cache: 'no-store',
    });
    const j = await r.json();
    return Number(j?.result) || 0;
  } catch {
    return 0;
  }
}

/** שומר ערך טקסט (לקודים קצרים) */
export async function kvSet(key: string, value: string): Promise<boolean> {
  if (!enabled()) return false;
  try {
    const r = await fetch(URL_!, { method: 'POST', headers: headers(), body: JSON.stringify(['SET', key, value]), cache: 'no-store' });
    const j = await r.json();
    return j?.result === 'OK';
  } catch {
    return false;
  }
}

/** קורא ערך טקסט (לקודים קצרים) */
export async function kvGetStr(key: string): Promise<string | null> {
  if (!enabled()) return null;
  try {
    const r = await fetch(URL_!, { method: 'POST', headers: headers(), body: JSON.stringify(['GET', key]), cache: 'no-store' });
    const j = await r.json();
    return j?.result != null ? String(j.result) : null;
  } catch {
    return null;
  }
}

/** קורא כמה מונים בבת אחת (pipeline). מחזיר מערך מספרים באותו סדר */
export async function kvMGet(keys: string[]): Promise<number[]> {
  if (!enabled() || keys.length === 0) return keys.map(() => 0);
  try {
    const r = await fetch(`${URL_}/pipeline`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(keys.map((k) => ['GET', k])),
      cache: 'no-store',
    });
    const arr = await r.json();
    return (Array.isArray(arr) ? arr : []).map((x: { result?: unknown }) => Number(x?.result) || 0);
  } catch {
    return keys.map(() => 0);
  }
}
