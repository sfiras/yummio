'use client';
import { useEffect, useState } from 'react';

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

// yummio-menu-anchor: פרסומת עוגן דביקה בתחתית — RPM גבוה במובייל. ניתנת לסגירה (מדיניות AdSense).
export default function AnchorAd() {
  const [closed, setClosed] = useState(false);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ANCHOR;

  useEffect(() => {
    if (client && slot) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
  }, [client, slot]);

  // שומרים מקום בתחתית הדף כדי שהעוגן הדביק לא יכסה את התוכן/הפוטר; משחררים כשסוגרים
  useEffect(() => {
    const show = !!client && !!slot && !closed;
    document.body.style.paddingBottom = show ? '76px' : '';
    return () => { document.body.style.paddingBottom = ''; };
  }, [client, slot, closed]);

  if (!client || !slot || closed) return null;

  return (
    <div className="anchor-ad" aria-label="פרסומת">
      <button className="anchor-close" onClick={() => setClosed(true)} aria-label="סגירה">✕</button>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '60px' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
