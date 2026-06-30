'use client';
import { useEffect, useState } from 'react';

type Recipe = { url: string; image: string; title: string; desc: string; time: string; level: string };
type StatRecipe = { i: number; title: string; wa: number; page: number; total: number };
type StatMenu = {
  slug: string; title: string; dateLabel: string; message: number;
  views: number; waTotal: number; pageTotal: number; clicks: number; ctr: number; recipes: StatRecipe[];
};

const empty = (): Recipe => ({ url: '', image: '', title: '', desc: '', time: '', level: 'קל' });
const todayISO = () => new Date().toLocaleDateString('en-CA');

export default function AdminPage() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [tab, setTab] = useState<'publish' | 'stats'>('publish');

  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState(1);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([empty()]);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ url: string; slug: string; recipes: Recipe[] } | null>(null);
  const [waLinks, setWaLinks] = useState<{ title: string; short: string }[] | null>(null);
  const [err, setErr] = useState('');

  const [stats, setStats] = useState<StatMenu[] | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('yummio-admin-pass');
    if (saved) { setPass(saved); verify(saved); }
  }, []);

  async function verify(p: string) {
    setAuthErr('');
    try {
      const r = await fetch('/api/check', { method: 'POST', headers: { 'x-admin-pass': p } });
      if (r.ok) { setAuthed(true); sessionStorage.setItem('yummio-admin-pass', p); }
      else setAuthErr('סיסמה שגויה');
    } catch { setAuthErr('שגיאת חיבור'); }
  }

  function update(i: number, field: keyof Recipe, val: string) {
    setRecipes((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    setRecipes((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const c = [...rs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  async function fetchMeta(i: number) {
    const url = recipes[i].url.trim();
    if (!url) return;
    setBusy(`מושך מתכון ${i + 1}...`);
    try {
      const r = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`, { headers: { 'x-admin-pass': pass } });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setRecipes((rs) => rs.map((rec, idx) => idx === i ? {
        ...rec, image: d.image || rec.image, title: rec.title || d.title || '', desc: rec.desc || d.desc || '',
      } : rec));
    } catch (e) { setErr(`משיכת מתכון ${i + 1} נכשלה: ${e}`); }
    finally { setBusy(''); }
  }

  async function fetchAll() {
    for (let i = 0; i < recipes.length; i++) {
      if (recipes[i].url.trim() && !recipes[i].image) await fetchMeta(i);
    }
  }

  function parseBulk() {
    const lines = bulk.split('\n');
    const hasUrl = (l: string) => /https?:\/\//.test(l);
    const firstUrlIdx = lines.findIndex(hasUrl);
    if (firstUrlIdx > 0) {
      const introText = lines.slice(0, firstUrlIdx).map((l) => l.trim()).filter(Boolean).join('\n');
      if (introText) setIntro(introText);
    }
    const urlRe = /(https?:\/\/[^\s]+)/;
    const rows: Recipe[] = [];
    for (const line of lines) {
      const m = line.match(urlRe);
      if (!m) continue;
      const r = empty();
      r.url = m[1];
      r.title = line.replace(m[1], '').replace(/[•\-–—:]/g, ' ').trim();
      rows.push(r);
    }
    if (rows.length) { setRecipes(rows); setBulk(''); }
    else setErr('לא נמצאו קישורים בטקסט');
  }

  async function publish() {
    setErr(''); setResult(null); setWaLinks(null); setBusy('מפרסם...');
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ date, message, title, intro, recipes }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'failed');
      const clean = recipes.filter((x) => x.title && x.url);
      setResult({ url: d.url, slug: d.slug, recipes: clean });
      // קיצור קישורים ב-bitly (תגית whatsapp). אם אין טוקן — נשארים עם קישורי /go
      try {
        const origin = window.location.origin;
        const items = clean.map((r2, i) => ({ title: r2.title, long_url: `${origin}/go/${d.slug}/${i}/wa` }));
        const sr = await fetch('/api/shorten', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
          body: JSON.stringify({ items }),
        });
        const sd = await sr.json();
        if (sd.links && sd.links.length) setWaLinks(sd.links);
      } catch { /* fallback */ }
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  function waBlock(): string {
    if (!result) return '';
    if (waLinks && waLinks.length) return waLinks.map((l) => `${l.title}\n${l.short}`).join('\n\n');
    return waLinksText(result.slug, result.recipes);
  }

  async function loadStats() {
    setStatsBusy(true);
    try {
      const r = await fetch('/api/stats', { method: 'POST', headers: { 'x-admin-pass': pass } });
      const d = await r.json();
      setStats(d.menus || []);
    } catch { setStats([]); }
    finally { setStatsBusy(false); }
  }

  function waLinksText(slug: string, list: Recipe[]) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return list.map((r, i) => `${r.title}\n${origin}/go/${slug}/${i}/wa`).join('\n\n');
  }

  // ----- מסך כניסה -----
  if (!authed) {
    return (
      <main className="admin-gate">
        <div className="admin-card" style={{ maxWidth: 360, width: '100%' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🍳 לוח ניהול Yummio</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 16 }}>הזינו סיסמה לכניסה</p>
          <input className="admin-input" type="password" placeholder="סיסמה" value={pass}
            onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify(pass)} />
          {authErr && <p className="admin-err">{authErr}</p>}
          <button className="admin-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => verify(pass)}>כניסה</button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-wrap">
      <header className="admin-top">
        <h1>🍳 לוח ניהול Yummio</h1>
        <a href="/" target="_blank" className="admin-link">צפייה באתר ↗</a>
      </header>

      <div className="admin-tabs">
        <button className={`admin-tab${tab === 'publish' ? ' active' : ''}`} onClick={() => setTab('publish')}>✍️ פרסום תפריט</button>
        <button className={`admin-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => { setTab('stats'); if (!stats) loadStats(); }}>📊 סטטיסטיקות</button>
      </div>

      {tab === 'publish' && (
        <>
          <section className="admin-card">
            <h2 className="admin-h2">פרטי התפריט</h2>
            <div className="admin-row3">
              <label>תאריך<input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label>מספר הודעה<input className="admin-input" type="number" min={1} value={message} onChange={(e) => setMessage(Number(e.target.value))} /></label>
              <label>כותרת<input className="admin-input" placeholder="לדוגמה: תפריט הערב" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            </div>
            <label style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
              מבוא (טקסט שמופיע מתחת לכותרת)
              <textarea className="admin-input" rows={2} style={{ marginTop: 6 }} placeholder="טקסט פתיחה קצר ומזמין... (מתמלא אוטומטית מהטקסט שתדביקו למטה)" value={intro} onChange={(e) => setIntro(e.target.value)} />
            </label>
            <p className="admin-hint">הקישור יהיה: <code>/menu/{date}-{message}</code></p>
          </section>

          <section className="admin-card">
            <h2 className="admin-h2">הדבקה מהירה מהודעת וואטסאפ</h2>
            <textarea className="admin-input" rows={4} placeholder="הדביקו את כל טקסט ההודעה (מבוא למעלה, ואז שם מתכון + קישור בכל שורה)..." value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <div className="admin-actions">
              <button className="admin-btn ghost" onClick={parseBulk}>חלץ מבוא + מתכונים מהטקסט</button>
              <button className="admin-btn ghost" onClick={fetchAll}>משוך את כל התמונות והכותרות אוטומטית</button>
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-h2-row">
              <h2 className="admin-h2">המתכונים ({recipes.length})</h2>
              <button className="admin-btn ghost sm" onClick={() => setRecipes((r) => [...r, empty()])}>+ הוסף מתכון</button>
            </div>

            {recipes.map((r, i) => (
              <div className="admin-recipe" key={i}>
                <div className="admin-recipe-head">
                  <span className="admin-num">{i + 1}</span>
                  <div className="admin-move">
                    <button onClick={() => move(i, -1)} aria-label="למעלה">↑</button>
                    <button onClick={() => move(i, 1)} aria-label="למטה">↓</button>
                  </div>
                  <button className="admin-del" onClick={() => setRecipes((rs) => rs.filter((_, idx) => idx !== i))} aria-label="מחיקה">✕</button>
                </div>
                <div className="admin-recipe-grid">
                  <label className="full">קישור המתכון (yummio)
                    <div className="admin-inline">
                      <input className="admin-input" placeholder="https://..." value={r.url} onChange={(e) => update(i, 'url', e.target.value)} />
                      <button className="admin-btn sm" onClick={() => fetchMeta(i)}>משוך</button>
                    </div>
                  </label>
                  <label className="full">כותרת<input className="admin-input" value={r.title} onChange={(e) => update(i, 'title', e.target.value)} /></label>
                  <label className="full">תיאור<input className="admin-input" value={r.desc} onChange={(e) => update(i, 'desc', e.target.value)} /></label>
                  <label>זמן הכנה<input className="admin-input" placeholder="15 דק׳" value={r.time} onChange={(e) => update(i, 'time', e.target.value)} /></label>
                  <label>רמה<input className="admin-input" placeholder="קל" value={r.level} onChange={(e) => update(i, 'level', e.target.value)} /></label>
                  <label className="full">קישור תמונה<input className="admin-input" placeholder="מתמלא אוטומטית במשיכה" value={r.image} onChange={(e) => update(i, 'image', e.target.value)} /></label>
                </div>
                {r.image && <img className="admin-preview" src={r.image} alt="" />}
              </div>
            ))}

            <button className="admin-btn big publish-inline" onClick={publish} disabled={!!busy}>🚀 פרסם תפריט</button>
            {busy && <p className="admin-busy" style={{ textAlign: 'center', marginTop: 10 }}>{busy}</p>}
            {err && <p className="admin-err" style={{ textAlign: 'center', marginTop: 10 }}>{err}</p>}
          </section>

          {result && (
            <section className="admin-card" style={{ borderColor: 'var(--accent)' }}>
              <p className="admin-ok" style={{ fontSize: 15 }}>✅ פורסם! יופיע באתר תוך ~30 שניות: <a href={result.url} target="_blank">{result.url}</a></p>
              <h2 className="admin-h2" style={{ marginTop: 16 }}>קישורים להודעת וואטסאפ</h2>
              <p className="admin-hint" style={{ marginBottom: 8 }}>
                {waLinks && waLinks.length
                  ? 'קישורי bit.ly מתויגים whatsapp — מוכנים להדבקה בהודעה (נספרים בנפרד מקליקים בעמוד).'
                  : 'קישורים מוכנים להדבקה (נספרים כ-whatsapp). חברו טוקן bitly ב-Vercel לקבלת bit.ly קצרים אוטומטית.'}
              </p>
              <textarea className="admin-input" rows={8} readOnly value={waBlock()} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
              <button className="admin-btn ghost sm" style={{ marginTop: 8 }}
                onClick={() => navigator.clipboard?.writeText(waBlock())}>העתק הכול</button>
            </section>
          )}
        </>
      )}

      {tab === 'stats' && (
        <section className="admin-card">
          <div className="admin-h2-row">
            <h2 className="admin-h2">סטטיסטיקות לפי הודעה</h2>
            <button className="admin-btn ghost sm" onClick={loadStats}>רענן</button>
          </div>
          {statsBusy && <p className="admin-busy">טוען...</p>}
          {!statsBusy && stats && stats.length === 0 && <p className="admin-hint">אין נתונים עדיין.</p>}
          {!statsBusy && stats && stats.map((m) => (
            <div className="stat-menu" key={m.slug}>
              <div className="stat-menu-head">
                <div>
                  <strong>{m.title}</strong> <span className="admin-hint">· {m.dateLabel} · הודעה {m.message}</span>
                </div>
                <a className="admin-link" href={`/menu/${m.slug}`} target="_blank">פתח ↗</a>
              </div>
              <div className="stat-chips">
                <span className="stat-chip">👁 צפיות: <b>{m.views}</b></span>
                <span className="stat-chip">📱 וואטסאפ: <b>{m.waTotal}</b></span>
                <span className="stat-chip">🖥 עמוד: <b>{m.pageTotal}</b></span>
                <span className="stat-chip">🔗 קליקים: <b>{m.clicks}</b></span>
                <span className="stat-chip">CTR: <b>{m.ctr}%</b></span>
              </div>
              <div className="stat-table">
                <div className="stat-row stat-head"><span>#</span><span>מתכון</span><span>וואטסאפ</span><span>עמוד</span><span>סה״כ</span></div>
                {m.recipes.map((r) => (
                  <div className="stat-row" key={r.i}>
                    <span>{r.i + 1}</span><span className="stat-title">{r.title}</span><span>{r.wa}</span><span>{r.page}</span><span><b>{r.total}</b></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'publish' && (
        <div className="admin-publish-bar">
          <div className="admin-publish-inner">
            {result ? (<span className="admin-ok">✅ פורסם! <a href={result.url} target="_blank">{result.url}</a></span>)
              : err ? (<span className="admin-err">{err}</span>)
              : busy ? (<span className="admin-busy">{busy}</span>)
              : (<span className="admin-bar-hint">מוכן לפרסום</span>)}
            <button className="admin-btn big" disabled={!!busy} onClick={publish}>🚀 פרסם תפריט</button>
          </div>
        </div>
      )}
    </main>
  );
}
