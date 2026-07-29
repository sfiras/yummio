'use client';
import { useEffect } from 'react';
import { BP } from '@/lib/base';

// סופר צפייה אחת לכל גלישה (פעם אחת ל-session) בעמוד התפריט
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = 'yv:' + slug;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    // מוסיפים את מקור ההגעה: ריק => כניסה ישירה (וואטסאפ ברוב המקרים)
    const ref = (() => { try { return document.referrer || ''; } catch { return ''; } })();
    fetch(BP + '/api/view?m=' + encodeURIComponent(slug) + '&r=' + encodeURIComponent(ref)).catch(() => {});
  }, [slug]);
  return null;
}
