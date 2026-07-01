// נתיב הבסיס של האפליקציה (למשל "/menus"). מגיע מ-NEXT_PUBLIC_BASE_PATH.
// ריק => האפליקציה רצה בשורש. משמש לבניית כתובות שהדפדפן פותר בעצמו
// (fetch ל-API, קישורי <a> פנימיים, ובניית קישורי וואטסאפ מ-window.location.origin).
export const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
