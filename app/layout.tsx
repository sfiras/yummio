import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yummio.example'),
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
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {ADSENSE && (
          <Script
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
          />
        )}
        {children}
      </body>
    </html>
  );
}
