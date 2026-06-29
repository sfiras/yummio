# 🚀 دليل النشر — من جهازك للإنترنت (بدون خبرة)

الكود كله جاهز. اللي بدك تعمله: تشغّله محلياً (اختياري للتجربة)، وبعدين تنشره على **Vercel** (مجاني).
كل الأوامر جاهزة للّصق. الجزء الوحيد اللي لازم تعمله بنفسك = تسجيل الدخول بحسابك (مرة وحدة).

---

## المتطلب الوحيد: تنصيب Node.js

1. افتح https://nodejs.org
2. نزّل النسخة **LTS** وثبّتها (Next, Next, Finish).
3. للتأكد، افتح الترمنال واكتب: `node -v` — لازم يطلع رقم مثل `v20.x`.

> الترمنال في VS Code: من القائمة العليا **Terminal → New Terminal**.

---

## الخطوة 1: افتح المشروع وشغّله محلياً (تجربة — اختياري)

في VS Code: **File → Open Folder** واختَر مجلد `yummio`.
بعدين في الترمنال الصق:

```bash
npm install
npm run dev
```

افتح المتصفّح على http://localhost:3000 — لازم تشوف الموقع. لإيقافه: `Ctrl + C`.

---

## الخطوة 2: انشر على الإنترنت (Vercel) — الطريقة الأسهل

الصق هذا الأمر في الترمنال (جوّا مجلد yummio):

```bash
npx vercel
```

رح يسألك أسئلة بسيطة — جاوب هيك:
- **Set up and deploy?** → اضغط Enter (Yes)
- **Which scope?** → اختَر حسابك (Enter)
- **Link to existing project?** → اكتب `n` ثم Enter
- **Project name?** → اضغط Enter (yummio)
- **In which directory is your code?** → اضغط Enter (`./`)
- أول مرة رح يطلب **تسجيل دخول** — رح يفتحلك صفحة بالمتصفّح، سجّل بإيميلك (Google/GitHub/Email)، وارجع للترمنال.

بعد ما يخلص، رح يعطيك رابط مثل `https://yummio-xxxx.vercel.app` — **هذا موقعك حي على الإنترنت!** 🎉

### لنشر النسخة النهائية (production):
```bash
npx vercel --prod
```

---

## الخطوة 3: إعدادات AdSense والدومين (مهم للربح)

### أ) متغيّرات البيئة على Vercel
1. ادخل https://vercel.com → مشروعك → **Settings → Environment Variables**.
2. أضف:
   - `NEXT_PUBLIC_ADSENSE_CLIENT` = `ca-pub-XXXXXXXXXXXXXXXX` (مزوّدك من AdSense)
   - `NEXT_PUBLIC_SITE_URL` = رابط موقعك (مثلاً `https://yummio.example`)
3. اضغط **Redeploy** عشان تتفعّل.

### ب) ملف ads.txt (شرط من Google عشان تتقاضى أرباحك)
أنشئ ملف `public/ads.txt` داخل المشروع وحط فيه السطر اللي بعطيك ياه AdSense، مثلاً:
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

### ج) ربط دومينك الخاص (اختياري)
Vercel → مشروعك → **Settings → Domains** → أضف دومينك واتبع إرشادات الـ DNS.

---

## الخطوة 4: إضافة تفريت/وصفات جديدة كل يوم

1. انسخ ملف من `data/menus/` وسمّيه بتاريخ اليوم، مثلاً `2026-07-01-1.json`.
2. عدّل الوصفات داخله (الصورة، العنوان، الوصف، الرابط، الوقت، المستوى).
3. لرسالة ثانية بنفس اليوم: ملف ثاني بنفس التاريخ ورقم `message: 2`.
4. ارفع التغيير:
```bash
npx vercel --prod
```
أو لو ربطت GitHub: كل `git push` بينشر تلقائياً.

> صفحة كل تفريت بتنبني لحالها، والترقيم 1،2،3… تلقائي.

---

## نصيحة: ربط GitHub للنشر التلقائي (مرة وحدة)

1. أنشئ حساب على https://github.com وأنشئ Repository فاضي اسمه `yummio`.
2. في الترمنال داخل المجلد:
```bash
git init
git add .
git commit -m "yummio launch"
git branch -M main
git remote add origin https://github.com/USERNAME/yummio.git
git push -u origin main
```
3. ادخل https://vercel.com → **Add New → Project** → اختَر ريبو `yummio` → **Deploy**.

بعد هيك، أي تعديل بتعمله + `git push` = الموقع بيتحدّث لحاله خلال ثواني.

---

## باختصار
| الخطوة | الأمر |
|--------|-------|
| تشغيل محلي | `npm install` ثم `npm run dev` |
| نشر سريع | `npx vercel` |
| نشر نهائي | `npx vercel --prod` |
| تحديث يومي | عدّل/أضف JSON ثم `npx vercel --prod` |
