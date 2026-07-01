/** @type {import('next').NextConfig} */
// מגישים את כל האפליקציה תחת נתיב משנה (למשל /menus) כדי לרוץ על yummio.co.il/menus.
// מקור אמת יחיד: משתנה הסביבה NEXT_PUBLIC_BASE_PATH. ריק => רץ בשורש (פיתוח מקומי).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const nextConfig = {
  basePath: BASE_PATH || undefined,
  reactStrictMode: true,
  images: {
    // הוסיפו כאן את הדומיינים של התמונות שלכם (yummio + ספק תמונות)
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.yummio.example' },
    ],
  },
};
module.exports = nextConfig;
