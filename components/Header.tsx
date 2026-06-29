'use client';
import { useEffect, useState } from 'react';

export default function Header() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('yummio-theme', next); } catch {}
    setTheme(next);
  }

  return (
    <header className="site">
      <div className="wrap bar">
        <a className="logo" href="/"><span className="dot">🍳</span> Yumm<b>io</b></a>
        <div className="head-right">
          <a className="header-cta" href="#recipes">המתכונים של היום</a>
          <button className="theme-btn" onClick={toggle} aria-label="מצב כהה/בהיר">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
