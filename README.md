# 🍳 Yummio — אתר מתכונים דינמי (Next.js)

אתר נחיתה מהיר ומותאם למובייל, בעברית (RTL), בעיצוב כחול 2026.
תפריט (Menu) חדש = עמוד חדש. תומך בכמה הודעות (רסאלות) באותו יום, מספור מתכונים ברור,
מצב כהה אוטומטי לפי השעה בישראל, ומיקומי AdSense מותאמים (in-feed + lazy-load + גובה שמור = אפס CLS).

---

## 🚀 התקנה והרצה

```bash
cd yummio
npm install
cp .env.example .env.local   # מלאו את NEXT_PUBLIC_ADSENSE_CLIENT
npm run dev                  # http://localhost:3000
```

לבנייה לפרודקשן:

```bash
npm run build
npm run start
```

---

## ➕ איך מוסיפים תפריט / מתכונים חדשים

כל תפריט הוא **קובץ JSON אחד** בתיקייה `data/menus/`.
שם הקובץ הוא ה-slug של העמוד והכתובת: `data/menus/2026-06-30-1.json` → `/menu/2026-06-30-1`.

### כמה הודעות באותו יום
פשוט צרו עוד קובץ עם אותו תאריך ו-`message` שונה:

```
data/menus/2026-06-30-1.json   ← הודעה 1 (בוקר)   → /menu/2026-06-30-1
data/menus/2026-06-30-2.json   ← הודעה 2 (ערב)    → /menu/2026-06-30-2
```

העמוד מציג אוטומטית כפתורי מעבר בין כל ההודעות של אותו יום.

### מבנה קובץ תפריט

```json
{
  "date": "2026-06-30",
  "message": 1,
  "title": "תפריט הבוקר",
  "recipes": [
    {
      "image": "https://.../shakshuka.jpg",
      "title": "שקשוקה פיקנטית",
      "desc": "תיאור קצר ומפתה שמשכנע ללחוץ.",
      "url": "https://yummio.example/shakshuka",
      "time": "15 דק׳",
      "level": "קל"
    }
  ]
}
```

- **המתכונים ממוספרים אוטומטית** 1,2,3... לפי הסדר במערך (תג מספר גדול וברור על כל כרטיס).
- אין צורך לערוך קוד — מוסיפים קובץ, וב-build/ISR העמוד נוצר לבד.
- דף הבית `/` מפנה תמיד לתפריט **האחרון** (לפי תאריך ואז מספר הודעה).

> טיפ: בהודעת הוואטסאפ שימו את הקישור לעמוד היומי בהתחלה, ואז את המתכונים כרגיל.

---

## 🖼️ תמונות

הקוד משתמש ב-`next/image` (resize, WebP, lazy אוטומטי).
הוסיפו את דומיין התמונות שלכם ב-`next.config.js` תחת `images.remotePatterns`.

---

## 💰 AdSense — מה כבר מוגדר

| מיקום | קומפוננטה | הערה |
|------|-----------|------|
| ראש העמוד (leaderboard) | `<AdSlot slot="TOP" />` | מעל הקיפול, viewability גבוה |
| In-feed בין מתכונים | אוטומטי אחרי כל 3 מתכונים | native, משתלב בפיד |

- כל יחידה היא **lazy-load** (IntersectionObserver) עם **גובה שמור** → CLS = 0.
- מלאו `NEXT_PUBLIC_ADSENSE_CLIENT` ב-`.env.local`; בלעדיו מוצג מציין מקום בלבד.
- אחרי שתאשרו ב-AdSense, החליפו את ערכי ה-`slot` במזהי היחידות האמיתיים שלכם.
- שולטים בצפיפות המודעות דרך הקבוע `AD_EVERY` בקובץ `app/menu/[slug]/page.tsx`.

### המלצות אופטימיזציה (חשוב)
- העדיפו **מודעות ידניות** על פני Auto Ads (שליטה ב-UX וב-CWV).
- הוסיפו **Anchor ad** (שובר תחתון) להגדלת RPM במובייל.
- מדדו **Session RPM**, לא רק Page RPM. בצעו A/B על `AD_EVERY` (2 מול 3).
- הרווח הגדול: מעבר משותף header-bidding (Ezoic עכשיו, Mediavine בהמשך) — פי 1.5–2.5 RPM.
- אם יש תנועה מאיחוד האירופי: הוסיפו CMP + Google Consent Mode.

---

## ☁️ פריסה (Vercel — מומלץ)

1. דחפו את התיקייה ל-GitHub.
2. ב-[vercel.com](https://vercel.com) → New Project → ייבוא הריפו.
3. הגדירו משתני סביבה: `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_SITE_URL`.
4. Deploy. `sitemap.xml` ו-`robots.txt` נוצרים אוטומטית.

ISR (`revalidate = 3600`) → העמודים מתעדכנים לבד כל שעה בלי deploy מחדש.

---

## 📁 מבנה הפרויקט

```
yummio/
├─ app/
│  ├─ layout.tsx            ← פונט, סקריפט מצב כהה, סקריפט AdSense
│  ├─ page.tsx              ← הפניה לתפריט האחרון
│  ├─ menu/[slug]/page.tsx  ← עמוד לכל תפריט (SSG + ISR)
│  ├─ sitemap.ts / robots.ts
│  └─ globals.css           ← ערכת כחול 2026 + מצב כהה
├─ components/
│  ├─ Header.tsx  (toggle מצב כהה)
│  ├─ RecipeCard.tsx  (כרטיס ממוספר)
│  ├─ AdSlot.tsx  (lazy + גובה שמור)
│  ├─ SaveButton.tsx · Footer.tsx
├─ data/menus/*.json        ← תפריט = קובץ
└─ lib/menus.ts             ← טעינת תפריטים
```
