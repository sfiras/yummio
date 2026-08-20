// מונים (קליקים/צפיות) וזיכרון מפתח-ערך — מגובים ב-Turso (libSQL) דרך HTTP.
// אותן פונקציות בדיוק כמו הגרסה הקודמת (Upstash) — שאר המערכת לא יודעת שמשהו השתנה.
// אם משתני הסביבה לא מוגדרים — הכל מחזיר 0/null בבטחה (בטוח לבנייה).

const RAW_URL = process.env.TURSO_DATABASE_URL || '';
const TOKEN = process.env.TURSO_AUTH_TOKEN || '';

// libsql://xxx.turso.io  =>  https://xxx.turso.io
const HTTP_URL = RAW_URL.replace(/^libsql:\/\//i, 'https://').replace(/\/$/, '');
const enabled = () => !!(HTTP_URL && TOKEN);

type Arg = string | number;
type Stmt = { sql: string; args?: Arg[] };

function toArg(v: Arg) {
  return typeof v === 'number'
    ? { type: 'integer', value: String(Math.trunc(v)) }
    : { type: 'text', value: String(v) };
}

/** מריץ שאילתות ב-pipeline אחד. מחזיר את מערך התוצאות (או null בכישלון). */
async function run(stmts: Stmt[]): Promise<unknown[] | null> {
  if (!enabled()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${HTTP_URL}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          ...stmts.map((s) => ({
            type: 'execute',
            stmt: { sql: s.sql, args: (s.args || []).map(toArg) },
          })),
          { type: 'close' },
        ],
      }),
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error('[turso] http', r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const j = await r.json();
    const results = Array.isArray(j?.results) ? j.results : [];
    const bad = results.find((x: { type?: string }) => x?.type === 'error');
    if (bad) {
      console.error('[turso] sql error', JSON.stringify(bad).slice(0, 200));
      return null;
    }
    return results;
  } catch (e) {
    console.error('[turso] fetch failed', String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// יצירת הטבלאות פעם אחת לכל אינסטנס (IF NOT EXISTS — זול ובטוח)
let ensured = false;
function schema(): Stmt[] {
  if (ensured) return [];
  ensured = true;
  return [
    { sql: 'CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)' },
    { sql: 'CREATE TABLE IF NOT EXISTS kvstore (k TEXT PRIMARY KEY, v TEXT NOT NULL)' },
  ];
}

/** שולף את הערך המספרי הראשון מתוצאת execute */
function firstNumber(res: unknown): number {
  const rows = (res as { response?: { result?: { rows?: { value?: string }[][] } } })?.response?.result?.rows;
  const cell = rows?.[0]?.[0];
  return cell ? Number(cell.value) || 0 : 0;
}

/** מגדיל מונה ב-1 ומחזיר את הערך החדש (0 אם המסד כבוי/נכשל) */
export async function kvIncr(key: string): Promise<number> {
  const pre = schema();
  const res = await run([
    ...pre,
    { sql: 'INSERT INTO counters (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n', args: [key] },
  ]);
  if (!res) return 0;
  return firstNumber(res[pre.length]);
}

/** קובע מונה לערך מדויק (לייבוא היסטוריה). לא מגדיל — מציב. */
export async function kvSetNum(key: string, n: number): Promise<boolean> {
  const pre = schema();
  const res = await run([
    ...pre,
    { sql: 'INSERT INTO counters (k, n) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET n = MAX(n, excluded.n)', args: [key, Math.trunc(n)] },
  ]);
  return !!res;
}

/** שומר ערך טקסט (לקודים קצרים). מחזיר false אם נכשל — הקוראים חייבים לבדוק! */
export async function kvSet(key: string, value: string): Promise<boolean> {
  const pre = schema();
  const res = await run([
    ...pre,
    { sql: 'INSERT INTO kvstore (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', args: [key, value] },
  ]);
  return !!res;
}

/** קורא ערך טקסט (לקודים קצרים) */
export async function kvGetStr(key: string): Promise<string | null> {
  const pre = schema();
  const res = await run([...pre, { sql: 'SELECT v FROM kvstore WHERE k = ?', args: [key] }]);
  if (!res) return null;
  const rows = (res[pre.length] as { response?: { result?: { rows?: { value?: string }[][] } } })?.response?.result?.rows;
  const cell = rows?.[0]?.[0];
  return cell?.value != null ? String(cell.value) : null;
}

/** קורא כמה מונים בשאילתה אחת. מחזיר מערך מספרים באותו סדר של המפתחות. */
export async function kvMGet(keys: string[]): Promise<number[]> {
  if (!enabled() || keys.length === 0) return keys.map(() => 0);
  const pre = schema();
  const placeholders = keys.map(() => '?').join(',');
  const res = await run([
    ...pre,
    { sql: `SELECT k, n FROM counters WHERE k IN (${placeholders})`, args: keys },
  ]);
  if (!res) return keys.map(() => 0);
  const rows = (res[pre.length] as { response?: { result?: { rows?: { value?: string }[][] } } })?.response?.result?.rows || [];
  const map: Record<string, number> = {};
  for (const row of rows) {
    const k = row?.[0]?.value;
    const n = row?.[1]?.value;
    if (k != null) map[String(k)] = Number(n) || 0;
  }
  return keys.map((k) => map[k] || 0);
}

/** בדיקת בריאות — מחזיר true אם אפשר לכתוב ולקרוא מהמסד */
export async function kvHealth(): Promise<{ ok: boolean; configured: boolean }> {
  if (!enabled()) return { ok: false, configured: false };
  const res = await run([...schema(), { sql: 'SELECT 1' }]);
  return { ok: !!res, configured: true };
}
