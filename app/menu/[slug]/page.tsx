import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RecipeCard from '@/components/RecipeCard';
import AdSlot from '@/components/AdSlot';
import ViewBeacon from '@/components/ViewBeacon';
import { getAllMenus, getMenu, getMenusForDate, formatHebrewDate } from '@/lib/menus';

// בנייה סטטית מראש לכל תפריט + רענון אוטומטי כל שעה (ISR)
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllMenus().map((m) => ({ slug: m.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const menu = getMenu(params.slug);
  if (!menu) return { title: 'Yummio' };
  const title = `${menu.title || 'תפריט'} · ${formatHebrewDate(menu.date)} | Yummio`;
  const description = `${menu.recipes.length} מתכונים טעימים ומהירים — ${menu.recipes.slice(0, 3).map((r) => r.title).join(' · ')}`;
  // תמונת תצוגה לוואטסאפ: התמונה שנבחרה לתפריט, אחרת תמונת המתכון הראשון
  const ogImage = menu.image?.trim() || menu.recipes[0]?.image;
  const images = ogImage ? [ogImage] : [];
  return {
    title,
    description,
    openGraph: { title, description, images, type: 'article', url: `/menu/${menu.slug}` },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

const AD_EVERY = 3; // מודעת in-feed אחרי כל 3 מתכונים

export default function MenuPage({ params }: { params: { slug: string } }) {
  const menu = getMenu(params.slug);
  if (!menu) notFound();

  const sameDay = getMenusForDate(menu.date); // כל ההודעות של אותו יום

  return (
    <>
      <Header />
      <ViewBeacon slug={menu.slug} />
      <main className="wrap">
        <section className="hero">
          <span className="pill">
            <span className="live" /> עודכן · {formatHebrewDate(menu.date)}
          </span>
          <h1>
            {menu.title ? <>{menu.title} </> : <>המתכונים </>}
            <span>של היום</span>
          </h1>
          <p>{menu.intro?.trim() || 'אוסף חדש ומפנק — פשוט, מהיר, ובדיוק מה שמתחשק. בחרו, לחצו, ותתחילו לבשל.'}</p>
          <div className="meta">
            <span><b>{menu.recipes.length}</b> מתכונים</span>
            <span>⏱️ <b>קלים להכנה</b></span>
            <span>⭐ <b>4.9</b> דירוג</span>
          </div>

          {/* ניווט בין כמה רסאלות (תפריטים) באותו יום */}
          {sameDay.length > 1 && (
            <nav className="msg-nav" aria-label="תפריטים נוספים היום">
              {sameDay.map((m) => (
                <a
                  key={m.slug}
                  href={`/menu/${m.slug}`}
                  className={`msg-chip${m.slug === menu.slug ? ' active' : ''}`}
                >
                  📩 {m.title || `הודעה ${m.message}`}
                </a>
              ))}
            </nav>
          )}
        </section>

        {/* מודעת ראש העמוד */}
        <AdSlot slot="TOP" minHeight={100} className="ad-leaderboard" />

        <section id="recipes">
          <div className="section-head">
            <h2>🔥 כל המתכונים</h2>
            <span className="total">{menu.recipes.length} מתכונים</span>
          </div>

          <div className="grid">
            {menu.recipes.map((recipe, i) => (
              <ReactFragmentWithAd
                key={i}
                index={i}
                isLast={i === menu.recipes.length - 1}
              >
                <RecipeCard recipe={recipe} number={i + 1} menuSlug={menu.slug} priority={i === 0} />
              </ReactFragmentWithAd>
            ))}
          </div>

          <p className="end-note">זה הכל להיום 🧡 חזרו מחר למתכונים חדשים</p>
        </section>
      </main>
      <Footer />
    </>
  );
}

/** עוטף כל כרטיס, ומזריק מודעת in-feed אחרי כל AD_EVERY מתכונים (לא אחרי האחרון) */
function ReactFragmentWithAd({
  index,
  isLast,
  children,
}: {
  index: number;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const showAd = (index + 1) % AD_EVERY === 0 && !isLast;
  return (
    <>
      {children}
      {showAd && <AdSlot slot="IN_FEED" format="fluid" minHeight={280} className="ad-infeed adcard" />}
    </>
  );
}
