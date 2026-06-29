'use client';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Props = {
  slot?: string;            // data-ad-slot מ-AdSense
  format?: string;          // "auto" | "fluid" וכו'
  layoutKey?: string;       // ל-in-feed native
  minHeight?: number;       // גובה שמור => אפס CLS
  className?: string;
};

/**
 * יחידת מודעה עם Lazy-load (נטענת רק כשמתקרבת למסך) וגובה שמור.
 * אם לא הוגדר NEXT_PUBLIC_ADSENSE_CLIENT — מוצג מציין מקום.
 */
export default function AdSlot({ slot, format = 'auto', layoutKey, minHeight = 280, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }),
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (visible && client) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
  }, [visible, client]);

  return (
    <div ref={ref} className={`ad ${className}`} style={{ minHeight }} aria-hidden="true">
      {client && visible ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
          {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : {})}
        />
      ) : (
        <span>◌ מודעה</span>
      )}
    </div>
  );
}
