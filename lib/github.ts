// כתיבת קובץ למאגר GitHub דרך ה-API (משמש את לוח הניהול לפרסום תפריט).
const API = 'https://api.github.com';
const GITHUB_TIMEOUT_MS = 10_000; // timeout ל-GitHub API — מניע תקיעה אינסופית

function repo(): string {
  return process.env.GITHUB_REPO || 'sfiras/yummio';
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'yummio-admin',
  };
}

/** fetch עם timeout — זורק שגיאה אם GitHub לא מגיב תוך GITHUB_TIMEOUT_MS */
function fetchGH(url: string, opts: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GITHUB_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** יוצר/מעדכן קובץ ב-data/menus דרך GitHub Contents API, ומפעיל פריסה אוטומטית ב-Vercel */
export async function putFile(path: string, content: string, message: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('missing GITHUB_TOKEN');

  const url = `${API}/repos/${repo()}/contents/${path}`;

  // אם הקובץ קיים — צריך את ה-sha שלו כדי לעדכן
  let sha: string | undefined;
  const head = await fetchGH(`${url}?ref=main`, { headers: authHeaders(token), cache: 'no-store' });
  if (head.ok) {
    const j = await head.json();
    sha = j.sha;
  }

  const res = await fetchGH(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha,
      branch: 'main',
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('הטוקן של GitHub פג או אינו תקין — יש לחדש את GITHUB_TOKEN בהגדרות Vercel.');
  }
  if (!res.ok) {
    throw new Error(`הפרסום ל-GitHub נכשל (${res.status}). נסו שוב בעוד רגע.`);
  }
  return res.json();
}

/** מחזיר את תוכן הקובץ כמחרוזת גולמית (UTF-8), או null אם לא קיים */
export async function getFileRaw(path: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const url = `${API}/repos/${repo()}/contents/${path}`;
  const r = await fetchGH(`${url}?ref=main`, { headers: authHeaders(token), cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json();
  return Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf-8');
}

/** מחזיר את תוכן הקובץ כ-JSON, או null אם לא קיים */
export async function getFileJson<T = unknown>(path: string): Promise<T | null> {
  const raw = await getFileRaw(path);
  if (raw == null) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

/** מוחק קובץ מהמאגר (משמש למחיקת תפריט). מפעיל פריסה אוטומטית ב-Vercel */
export async function deleteFile(path: string, message: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('missing GITHUB_TOKEN');

  const url = `${API}/repos/${repo()}/contents/${path}`;

  // צריך את ה-sha של הקובץ כדי למחוק
  const head = await fetchGH(`${url}?ref=main`, { headers: authHeaders(token), cache: 'no-store' });
  if (head.status === 404) return { ok: true, missing: true };
  if (head.status === 401 || head.status === 403) {
    throw new Error('הטוקן של GitHub פג או אינו תקין — יש לחדש את GITHUB_TOKEN בהגדרות Vercel.');
  }
  if (!head.ok) throw new Error(`קריאת הקובץ מ-GitHub נכשלה (${head.status}).`);
  const { sha } = await head.json();

  const res = await fetchGH(url, {
    method: 'DELETE',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: 'main' }),
  });

  if (!res.ok) {
    throw new Error(`המחיקה מ-GitHub נכשלה (${res.status}).`);
  }
  return res.json();
}
