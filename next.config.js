/** @type {import('next').NextConfig} */
const nextConfig = {
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
