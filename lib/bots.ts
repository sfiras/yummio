// זיהוי בוטים/סורקים כדי לא לזהם את הסטטיסטיקות
// (וואטסאפ/פייסבוק מושכים תצוגה מקדימה של קישורים, גוגלבוט, וכו').
const BOT_RE = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|twitterbot|discord|linkedin|bingpreview|preview|headless|phantom|monitor|pingdom|uptime|curl|wget|python-requests|axios|okhttp|go-http|libwww|scrapy/i;

/** true אם ה-User-Agent נראה כמו בוט/סקריפט (או ריק) — לא סופרים כאלה */
export function isBot(ua: string | null | undefined): boolean {
  if (!ua) return true; // בלי User-Agent = כנראה סקריפט/בוט
  return BOT_RE.test(ua);
}
