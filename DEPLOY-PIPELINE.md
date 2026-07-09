# Deploy Pipeline — Yummio

מסמך זה מגדיר את צנרת הפריסה ה"נכונה" (P0 בתוכנית ה-refactor).
המטרה: **אף קוד שבור לא עולה לפרודקשן, ואין יותר העלאות קובץ-קובץ ידניות.**

---

## 1. שער האיכות (CI) — פעיל אוטומטית

בכל דחיפה ל-`main` (וכל Pull Request) רץ GitHub Actions
(`.github/workflows/ci.yml`) ומריץ:

1. `npm ci` — התקנה נקייה מ-`package-lock.json`.
2. `npm run typecheck` — `tsc --noEmit` במצב strict.
3. `npm run build` — `next build` מלא.

אם משהו נכשל — ה-commit מסומן ב-❌ אדום ב-GitHub.
**Vercel ממילא לא מפרסם build שנכשל** — הגרסה הקודמת נשארת חיה.
כך הפרודקשן מוגן בשתי שכבות.

> הרחבה עתידית: להוסיף `npm run lint` (דורש הוספת `eslint` + `eslint-config-next`
> ו-regen ל-lockfile), ולהפעיל Branch Protection על `main` שדורש CI ירוק לפני מיזוג.

---

## 2. הפריסה — במקום העלאות ידניות

### הדרך המומלצת (ללא טרמינל) — GitHub Desktop

חד-פעמי:
1. התקינו **GitHub Desktop** (https://desktop.github.com), התחברו לחשבון `sfiras`.
2. `File → Clone repository → sfiras/yummio` לתיקייה חדשה במחשב.
3. חברו את Cowork/Claude לעבוד **בתוך התיקייה המשוכפלת הזו**
   (כך שכל עריכה של Claude מופיעה שם כ-diff).

בכל פרסום (במקום עשרות העלאות):
1. פותחים GitHub Desktop — רואים את כל השינויים כ-diff ברור.
2. כותבים הודעת commit → **Commit to main**.
3. לוחצים **Push origin**.
4. Vercel מפרסם אוטומטית, ו-CI מריץ typecheck + build.

זהו — commit אחד אטומי, נראה לעין, במקום קובץ-קובץ.

### חלופה (טרמינל, לעתיד)
```bash
git add -A
git commit -m "תיאור"
git push
```

---

## 3. הרצה מקומית לפני push (מומלץ)
```bash
npm ci          # פעם ראשונה / אחרי שינוי dependencies
npm run typecheck
npm run build
```
אם שניהם עוברים — בטוח לדחוף.
