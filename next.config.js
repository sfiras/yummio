/** @type {import('next').NextConfig} */
// מגישים את כל האפליקציה תחת נתיב משנה (למשל /menus) כדי לרוץ על yummio.co.il/menus.
// מקור אמת יחיד: משתנה הסביבה NEXT_PUBLIC_BASE_PATH. ריק => רץ בשורש (פיתוח מקומי).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const SECURITY_HEADERS = [
  // מניעת clickjacking — לא ניתן להטמין את האתר ב-iframe
  { key: 'X-Frame-Options', value: 'DENY' },
  // מניעת MIME sniffing — דפדפן מכבד את Content-Type שהוגדר
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // הגבלת מידע ב-Referer header לאותו origin
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // הגנה בסיסית מפני XSS בדפדפנים ישנים
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // ביטול גישה למצלמה / מיקרופון / מיקום
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  basePath: BASE_PATH || undefined,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.yummio.co.il' },
      { protocol: 'https', hostname: 'yummio.co.il' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
};
module.exports = nextConfig;
