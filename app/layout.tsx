import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yummio.co.il/menus'),
  title: 'Yummio · מתכונים מהירים וטעימים',
  description: 'אוסף מתכונים חדש בכל יום — פשוט, מהיר וטעים. לחצו, בשלו, תיהנו.',
  openGraph: { title: 'Yummio · המתכונים של היום', description: 'אוסף מתכונים חדש בכל יום — פשוט, מהיר וטעים.', type: 'website' },
};

// מונע הבהוב: קובע מצב כהה לפי השעה בישראל (לילה => כהה) או לפי בחירה ידנית שמורה
const themeScript = `
(function(){try{
  var s=localStorage.getItem('yummio-theme');
  var m=s||((function(){var h=parseInt(new Date().toLocaleString('en-US',{timeZone:'Asia/Jerusalem',hour:'2-digit',hour12:false}),10);return (h>=19||h<6)?'dark':'light';})());
  document.documentElement.setAttribute('data-theme',m);
  var ui=localStorage.getItem('yummio-ui')||'v1';
  document.documentElement.setAttribute('data-ui',ui);
}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.setAttribute('data-ui','v1');}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {/* סקריפט AdSense נטען רק בעמודי /menu (ראו app/menu/layout.tsx) — לא בלוח הניהול ולא בדף הבית */}
        {GA_ID && (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
