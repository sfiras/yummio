import { redirect } from 'next/navigation';
import { getLatestMenu } from '@/lib/menus';

export const revalidate = 3600;

// דף הבית מפנה אוטומטית לתפריט האחרון שהתפרסם
export default function Home() {
  const latest = getLatestMenu();
  if (latest) redirect(`/menu/${latest.slug}`);
  return (
    <main className="wrap" style={{ padding: '60px 16px', textAlign: 'center' }}>
      <h1>Yummio</h1>
      <p>עדיין אין תפריטים. הוסיפו קובץ ל-<code>data/menus</code>.</p>
    </main>
  );
}
