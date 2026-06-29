import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ניהול · Yummio',
  robots: { index: false, follow: false }, // לא ייכלל בגוגל
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
