// כתיבת קובץ למאגר GitHub דרך ה-API (משמש את לוח הניהול לפרסום תפריט).
const API = 'https://api.github.com';

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

/** יוצר/מעדכן קובץ ב-data/menus דרך GitHub Contents API, ומפעיל פריסה אוטומטית ב-Vercel */
export async function putFile(path: string, content: string, message: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('missing GITHUB_TOKEN');

  const url = `${API}/repos/${repo()}/contents/${path}`;

  // אם הקובץ קיים — צריך את ה-sha שלו כדי לעדכן
  let sha: string | undefined;
  const head = await fetch(`${url}?ref=main`, { headers: authHeaders(token), cache: 'no-store' });
  if (head.ok) {
    const j = await head.json();
    sha = j.sha;
  }

  const res = await fetch(url, {
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

/** מחזיר את תוכן הקובץ כ-JSON, או null אם לא קיים */
export async function getFileJson<T = unknown>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const url = `${API}/repos/${repo()}/contents/${path}`;
  const r = await fetch(`${url}?ref=main`, { headers: authHeaders(token), cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json();
  return JSON.parse(Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf-8')) as T;
}

/** מוחק קובץ מהמאגר (משמש למחיקת תפריט). מפעיל פריסה אוטומטית ב-Vercel */
export async function deleteFile(path: string, message: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('missing GITHUB_TOKEN');

  const url = `${API}/repos/${repo()}/contents/${path}`;

  // צריך את ה-sha של הקובץ כדי למחוק
  const head = await fetch(`${url}?ref=main`, { headers: authHeaders(token), cache: 'no-store' });
  if (head.status === 404) return { ok: true, missing: true };
  if (head.status === 401 || head.status === 403) {
    throw new Error('הטוקן של GitHub פג או אינו תקין — יש לחדש את GITHUB_TOKEN בהגדרות Vercel.');
  }
  if (!head.ok) throw new Error(`קריאת הקובץ מ-GitHub נכשלה (${head.status}).`);
  const { sha } = await head.json();

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: 'main' }),
  });

  if (!res.ok) {
    throw new Error(`המחיקה מ-GitHub נכשלה (${res.status}).`);
  }
  return res.json();
}
