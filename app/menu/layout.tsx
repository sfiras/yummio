import Script from 'next/script';

// טוען את סקריפט AdSense רק בעמודי המתכונים (/menu/*).
// כך אין פרסומות/סקריפט פרסום בלוח הניהול (/admin) או בדף הבית.
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {ADSENSE && (
        <Script
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
        />
      )}
      {children}
    </>
  );
}
