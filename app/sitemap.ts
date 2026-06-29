import type { MetadataRoute } from 'next';
import { getAllMenus } from '@/lib/menus';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://yummio.example';
  const menus = getAllMenus();
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...menus.map((m) => ({
      url: `${base}/menu/${m.slug}`,
      lastModified: new Date(m.date),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
