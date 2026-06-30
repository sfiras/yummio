'use client';
import { useEffect } from 'react';

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
    fetch('/api/view?m=' + encodeURIComponent(slug)).catch(() => {});
  }, [slug]);
  return null;
}
