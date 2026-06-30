'use client';
import { useEffect, useState } from 'react';

type Recipe = { url: string; image: string; title: string; desc: string; time: string; level: string };
type StatRecipe = { i: number; title: string; wa: number; page: number; total: number };
type StatMenu = {
  slug: string; title: string; dateLabel: string; message: number;
  views: number; waTotal: number; pageTotal: number; clicks: number; ctr: number; recipes: StatRecipe[];
};
type View = 'overview' | 'publish' | 'menus' | 'stats' | 'settings';

const empty = (): Recipe => ({ url: '', image: '', title: '', desc: '', time: '', level: 'קל' });
const todayISO = () => new Date().toLocaleDateString('en-CA');
const norm = (r: Partial<Recipe>): Recipe => ({
  url: r.url || '', image: r.image || '', title: r.title || '', desc: r.desc || '', time: r.time || '', level: r.level || 'קל',
});

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'ראשי', icon: '🏠' },
  { id: 'publish', label: 'פרסום', icon: '✍️' },
  { id: 'menus', label: 'תפריטים', icon: '🗂️' },
  { id: 'stats', label: 'סטטיסטיקות', icon: '📊' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️' },
];

export default function AdminPage() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [view, setView] = useState<View>('overview');
  const [navOpen, setNavOpen] = useState(false);

  // composer
  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState(1);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [image, setImage] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([empty()]);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ url: string; slug: string; recipes: Recipe[] } | null>(null);
  const [waLinks, setWaLinks] = useState<{ title: string; short: string }[] | null>(null);
  const [err, setErr] = useState('');

  // stats
  const [stats, setStats] = useState<StatMenu[] | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    setTheme(t);
    const saved = sessionStorage.getItem('yummio-admin-pass');
    if (saved) { setPass(saved); verify(saved); }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('yummio-theme', next); } catch {}
    setTheme(next);
  }

  async function verify(p: string) {
    setAuthErr('');
    try {
      const r = await fetch('/api/check', { method: 'POST', headers: { 'x-admin-pass': p } });
      if (r.ok) { setAuthed(true); sessionStorage.setItem('yummio-admin-pass', p); loadStats(p); }
      else setAuthErr('סיסמה שגויה');
    } catch { setAuthErr('שגיאת חיבור'); }
  }

  async function loadStats(p = pass) {
    setStatsBusy(true);
    try {
      const r = await fetch('/api/stats', { method: 'POST', headers: { 'x-admin-pass': p } });
      const d = await r.json();
      setStats(d.menus || []);
    } catch { setStats([]); }
    finally { setStatsBusy(false); }
  }

  // ---- composer helpers ----
  function update(i: number, field: keyof Recipe, val: string) {
    setRecipes((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    setRecipes((rs) => {
      const j = i + dir; if (j < 0 || j >= rs.length) return rs;
      const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c;
    });
  }
  function resetComposer() {
    setTitle(''); setIntro(''); setImage(''); setRecipes([empty()]);
    setDate(todayISO()); setMessage(1); setBulk(''); setResult(null); setWaLinks(null); setErr('');
  }
  function goPublishNew() { resetComposer(); setView('publish'); setNavOpen(false); }

  async function loadMenu(slug: string, keepSlug: boolean) {
    setBusy('טוען תפריט...');
    try {
      const r = await fetch(`/api/menu?slug=${encodeURIComponent(slug)}`, { headers: { 'x-admin-pass': pass } });
      const d = await r.json();
      if (!d.menu) throw new Error('not found');
      const m = d.menu;
      setTitle(m.title || ''); setIntro(m.intro || ''); setImage(m.image || '');
      setRecipes(m.recipes?.length ? m.recipes.map(norm) : [empty()]);
      if (keepSlug) { setDate(m.date); setMessage(m.message); }
      else { setDate(todayISO()); setMessage(1); }
      setResult(null); setWaLinks(null); setErr(''); setBulk('');
      setView('publish'); setNavOpen(false);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  async function fetchMeta(i: number) {
    const url = recipes[i].url.trim(); if (!url) return;
    setBusy(`מושך מתכון ${i + 1}...`);
    try {
      const r = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`, { headers: { 'x-admin-pass': pass } });
      const d = await r.json(); if (d.error) throw new Error(d.error);
      setRecipes((rs) => rs.map((rec, idx) => idx === i ? {
        ...rec, image: d.image || rec.image, title: rec.title || d.title || '', desc: rec.desc || d.desc || '',
      } : rec));
    } catch (e) { setErr(`משיכת מתכון ${i + 1} נכשלה: ${e}`); }
    finally { setBusy(''); }
  }
  async function fetchAll() {
    for (let i = 0; i < recipes.length; i++) if (recipes[i].url.trim() && !recipes[i].image) await fetchMeta(i);
  }

  function parseBulk() {
    const lines = bulk.split('\n');
    const firstUrlIdx = lines.findIndex((l) => /https?:\/\//.test(l));
    if (firstUrlIdx > 0) {
      const introText = lines.slice(0, firstUrlIdx).map((l) => l.trim()).filter(Boolean).join('\n');
      if (introText) setIntro(introText);
    }
    const urlRe = /(https?:\/\/[^\s]+)/;
    const rows: Recipe[] = [];
    for (const line of lines) {
      const m = line.match(urlRe); if (!m) continue;
      const r = empty(); r.url = m[1]; r.title = line.replace(m[1], '').replace(/[•\-–—:]/g, ' ').trim(); rows.push(r);
    }
    if (rows.length) { setRecipes(rows); setBulk(''); } else setErr('לא נמצאו קישורים בטקסט');
  }

  async function publish() {
    setErr(''); setResult(null); setWaLinks(null); setBusy('מפרסם...');
    try {
      const r = await fetch('/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ date, message, title, intro, image, recipes }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'failed');
      const clean = recipes.filter((x) => x.title && x.url);
      setResult({ url: d.url, slug: d.slug, recipes: clean });
      loadStats();
      try {
        const origin = window.location.origin;
        const items = clean.map((r2, i) => ({ title: r2.title, long_url: `${origin}/go/${d.slug}/${i}/wa` }));
        const sr = await fetch('/api/shorten', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass }, body: JSON.stringify({ items }),
        });
        const sd = await sr.json();
        if (sd.links && sd.links.length) setWaLinks(sd.links);
      } catch {}
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  function waLinksText(slug: string, list: Recipe[]) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return list.map((r, i) => `${r.title}\n${origin}/go/${slug}/${i}/wa`).join('\n\n');
  }
  function waBlock(): string {
    if (!result) return '';
    if (waLinks && waLinks.length) return waLinks.map((l) => `${l.title}\n${l.short}`).join('\n\n');
    return waLinksText(result.slug, result.recipes);
  }

  // ---- KPIs ----
  const totals = (() => {
    if (!stats) return null;
    const views = stats.reduce((s, m) => s + m.views, 0);
    const clicks = stats.reduce((s, m) => s + m.clicks, 0);
    let top = { title: '—', total: 0 };
    for (const m of stats) for (const r of m.recipes) if (r.total > top.total) top = { title: r.title, total: r.total };
    return { views, clicks, ctr: views ? Math.round((clicks / views) * 100) : 0, menus: stats.length, top };
  })();

  // ===================== GATE =====================
  if (!authed) {
    return (
      <main className="admin-gate">
        <div className="admin-card" style={{ maxWidth: 360, width: '100%' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🍳 Yummio Studio</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 16 }}>הזינו סיסמה לכניסה</p>
          <input className="admin-input" type="password" placeholder="סיסמה" value={pass}
            onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify(pass)} />
          {authErr && <p className="admin-err">{authErr}</p>}
          <button className="admin-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => verify(pass)}>כניסה</button>
        </div>
      </main>
    );
  }

  const sectionTitle = NAV.find((n) => n.id === view)?.label || '';

  // ===================== SHELL =====================
  return (
    <div className="studio">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`studio-nav${navOpen ? ' open' : ''}`}>
        <div className="studio-logo"><span className="dot">🍳</span> Yumm<b>io</b> <span className="studio-logo-sub">Studio</span></div>
        <nav className="studio-navlist">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item${view === n.id ? ' active' : ''}`}
              onClick={() => { setView(n.id); setNavOpen(false); }}>
              <span className="nav-ico">{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="studio-nav-foot">
          <button className="nav-item" onClick={toggleTheme}><span className="nav-ico">{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</button>
          <a className="nav-item" href="/" target="_blank"><span className="nav-ico">↗</span> צפייה באתר</a>
        </div>
      </aside>

      <div className="studio-main">
        <header className="studio-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="תפריט">☰</button>
            <h1>{sectionTitle}</h1>
          </div>
          {view !== 'publish' && <button className="admin-btn sm" onClick={goPublishNew}>+ תפריט חדש</button>}
        </header>

        <div className="studio-content">
          {view === 'overview' && renderOverview()}
          {view === 'publish' && renderPublish()}
          {view === 'menus' && renderMenus()}
          {view === 'stats' && renderStats()}
          {view === 'settings' && renderSettings()}
        </div>
      </div>
    </div>
  );

  // ===================== VIEWS =====================
  function renderOverview() {
    return (
      <>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">👁 צפיות (סה״כ)</div><div className="kpi-val">{totals ? totals.views.toLocaleString() : '—'}</div></div>
          <div className="kpi"><div className="kpi-label">🔗 קליקים (סה״כ)</div><div className="kpi-val">{totals ? totals.clicks.toLocaleString() : '—'}</div></div>
          <div className="kpi"><div className="kpi-label">📈 CTR ממוצע</div><div className="kpi-val">{totals ? totals.ctr + '%' : '—'}</div></div>
          <div className="kpi"><div className="kpi-label">🗂️ תפריטים</div><div className="kpi-val">{totals ? totals.menus : '—'}</div></div>
        </div>

        {totals && totals.top.total > 0 && (
          <div className="admin-card" style={{ marginTop: 16 }}>
            <div className="kpi-label">🏆 המתכון המוביל</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
              <strong style={{ fontSize: 17 }}>{totals.top.title}</strong>
              <span className="admin-hint">{totals.top.total} קליקים</span>
            </div>
          </div>
        )}

        <div className="cta-row">
          <button className="admin-btn big" style={{ flex: 1 }} onClick={goPublishNew}>✍️ פרסם תפריט חדש</button>
          <button className="admin-btn ghost big" style={{ flex: 1 }} onClick={() => setView('menus')}>🗂️ כל התפריטים</button>
        </div>

        <div className="admin-h2-row" style={{ marginTop: 22 }}>
          <h2 className="admin-h2">תפריטים אחרונים</h2>
          <button className="admin-btn ghost sm" onClick={() => loadStats()}>רענן</button>
        </div>
        {statsBusy && <p className="admin-busy">טוען...</p>}
        {stats && stats.slice(0, 5).map((m) => menuRow(m))}
        {stats && stats.length === 0 && <p className="admin-hint">אין תפריטים עדיין. לחצו "פרסם תפריט חדש".</p>}
      </>
    );
  }

  function renderMenus() {
    const list = (stats || []).filter((m) =>
      !menuQuery || m.title.includes(menuQuery) || m.slug.includes(menuQuery) || m.dateLabel.includes(menuQuery));
    return (
      <>
        <input className="admin-input" placeholder="🔍 חיפוש לפי שם / תאריך..." value={menuQuery} onChange={(e) => setMenuQuery(e.target.value)} style={{ marginBottom: 14 }} />
        {statsBusy && <p className="admin-busy">טוען...</p>}
        {list.map((m) => menuRow(m, true))}
        {!statsBusy && list.length === 0 && <p className="admin-hint">לא נמצאו תפריטים.</p>}
      </>
    );
  }

  function menuRow(m: StatMenu, withActions = false) {
    return (
      <div className="menu-row" key={m.slug}>
        <div className="menu-row-main">
          <div className="menu-row-title"><strong>{m.title}</strong> <span className="admin-hint">· {m.dateLabel} · הודעה {m.message}</span></div>
          <div className="menu-row-chips">
            <span className="stat-chip">👁 {m.views}</span>
            <span className="stat-chip">🔗 {m.clicks}</span>
            <span className="stat-chip">CTR {m.ctr}%</span>
          </div>
        </div>
        <div className="menu-row-actions">
          <a className="admin-btn ghost sm" href={`/menu/${m.slug}`} target="_blank">פתח ↗</a>
          {withActions && <button className="admin-btn ghost sm" onClick={() => loadMenu(m.slug, false)}>שכפל</button>}
          {withActions && <button className="admin-btn ghost sm" onClick={() => loadMenu(m.slug, true)}>עריכה</button>}
        </div>
      </div>
    );
  }

  function renderPublish() {
    return (
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
          <label style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            תמונת תצוגה לוואטסאפ (לא חובה — ברירת מחדל: תמונת המתכון הראשון)
            <div className="admin-inline" style={{ marginTop: 6 }}>
              <input className="admin-input" placeholder="קישור תמונה..." value={image} onChange={(e) => setImage(e.target.value)} />
              <button className="admin-btn sm" type="button" onClick={() => setImage(recipes[0]?.image || '')}>מהמתכון הראשון</button>
            </div>
          </label>
          {image && <img className="admin-preview" src={image} alt="" style={{ width: 200, height: 110 }} />}
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
              {waLinks && waLinks.length ? 'קישורי bit.ly מתויגים whatsapp — מוכנים להדבקה.' : 'קישורים מוכנים להדבקה (נספרים כ-whatsapp).'}
            </p>
            <textarea className="admin-input" rows={8} readOnly value={waBlock()} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
            <button className="admin-btn ghost sm" style={{ marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(waBlock())}>העתק הכול</button>
          </section>
        )}
      </>
    );
  }

  function renderStats() {
    return (
      <>
        <div className="admin-h2-row">
          <h2 className="admin-h2">סטטיסטיקות לפי הודעה</h2>
          <button className="admin-btn ghost sm" onClick={() => loadStats()}>רענן</button>
        </div>
        {statsBusy && <p className="admin-busy">טוען...</p>}
        {!statsBusy && stats && stats.length === 0 && <p className="admin-hint">אין נתונים עדיין.</p>}
        {!statsBusy && stats && stats.map((m) => (
          <div className="stat-menu" key={m.slug}>
            <div className="stat-menu-head">
              <div><strong>{m.title}</strong> <span className="admin-hint">· {m.dateLabel} · הודעה {m.message}</span></div>
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
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <div className="admin-card">
          <h2 className="admin-h2">מצב המערכת</h2>
          <div className="set-row"><span>אתר חי</span><a className="admin-link" href="/" target="_blank">yummio.vercel.app ↗</a></div>
          <div className="set-row"><span>מאגר קוד</span><a className="admin-link" href="https://github.com/sfiras/yummio" target="_blank">GitHub ↗</a></div>
          <div className="set-row"><span>פריסה</span><a className="admin-link" href="https://vercel.com/firassomreh-6317s-projects/yummio" target="_blank">Vercel ↗</a></div>
          <div className="set-row"><span>אנליטיקס</span><a className="admin-link" href="https://analytics.google.com" target="_blank">GA4 ↗</a></div>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">תזכורות</h2>
          <p className="admin-hint">• טוקן GitHub פג בערך ב-30 ביולי 2026 — אז הפרסום מהלוח ייעצר עד שניצור טוקן חדש.</p>
          <p className="admin-hint" style={{ marginTop: 6 }}>• bitly חינמי = 5 קישורים/חודש. לכמות גדולה — דומיין קצר משלך (בקרוב).</p>
          <p className="admin-hint" style={{ marginTop: 6 }}>• AdSense עדיין לא חובר (NEXT_PUBLIC_ADSENSE_CLIENT + ads.txt).</p>
        </div>
        <button className="admin-btn ghost" onClick={() => { sessionStorage.removeItem('yummio-admin-pass'); location.reload(); }}>התנתק</button>
      </>
    );
  }
}
