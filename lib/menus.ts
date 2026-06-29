import fs from 'node:fs';
import path from 'node:path';

export type Recipe = {
  image: string;   // כתובת תמונה
  title: string;   // שם המתכון
  desc: string;    // תיאור מפתה קצר
  url: string;     // קישור לעמוד המתכון ב-yummio
  time: string;    // זמן הכנה, למשל "15 דק׳"
  level: string;   // רמת קושי, למשל "קל"
};

export type Menu = {
  slug: string;      // נגזר משם הקובץ, למשל 2026-06-29-1
  date: string;      // "2026-06-29"
  message: number;   // מספר ההודעה באותו יום (1, 2, 3...)
  title?: string;    // כותרת אופציונלית
  recipes: Recipe[];
};

const DATA_DIR = path.join(process.cwd(), 'data', 'menus');

/** קורא את כל קובצי התפריט מתיקיית data/menus */
export function getAllMenus(): Menu[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  const menus = files.map((file) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
    const data = JSON.parse(raw) as Omit<Menu, 'slug'>;
    return { ...data, slug: file.replace(/\.json$/, '') } as Menu;
  });
  // מהחדש לישן: לפי תאריך, ואז לפי מספר ההודעה
  return menus.sort((a, b) =>
    a.date === b.date ? b.message - a.message : a.date < b.date ? 1 : -1
  );
}

export function getMenu(slug: string): Menu | undefined {
  return getAllMenus().find((m) => m.slug === slug);
}

export function getLatestMenu(): Menu | undefined {
  return getAllMenus()[0];
}

/** כל ההודעות (תפריטים) של אותו יום, ממוין לפי מספר ההודעה */
export function getMenusForDate(date: string): Menu[] {
  return getAllMenus()
    .filter((m) => m.date === date)
    .sort((a, b) => a.message - b.message);
}

/** תאריך בעברית, למשל "29 ביוני 2026" */
export function formatHebrewDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}
