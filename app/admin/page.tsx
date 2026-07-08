'use client';
import { useEffect, useState } from 'react';
import { BP } from '@/lib/base';

type Recipe = {
  url: string; image: string; title: string; desc: string; time: string; level: string;
  author: string; msgTitle: string; msgDesc: string;
};
type StatRecipe = { i: number; title: string; wa: number; page: number; total: number };
type StatMenu = {
  slug: string; title: string; dateLabel: string; message: number;
  views: number; waTotal: number; pageTotal: number; clicks: number; ctr: number;
  sends?: number; lastSent?: string | null; recipes: StatRecipe[];
};
type View = 'overview' | 'publish' | 'menus' | 'stats' | 'settings';

const empty = (): Recipe => ({ url: '', image: '', title: '', desc: '', time: '', level: '', author: '', msgTitle: '', msgDesc: '' });
const norm = (r: Partial<Recipe>): Recipe => ({
  url: r.url || '', image: r.image || '', title: r.title || '', desc: r.desc || '',
  time: r.time || '', level: r.level || '', author: r.author || '', msgTitle: '', msgDesc: '',
});
const todayISO = () => new Date().toLocaleDateString('en-CA');
const EMO = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const WA_DEFAULTS = {
  opening: 'עוד לא סגרתם את התפריט? הנה כמה רעיונות ששווה לשמור עכשיו 😋',
  notes: '*אם קישור לא נפתח, שמרו את המספר שלנו באנשי הקשר ונסו שוב.*\n*תשתפו את קישור הקבוצה שכל החברות ייהנו גם!*',
  group: '',
  closing: 'תשמרו עכשיו, תודו לעצמכם מחר ❤️\n*מתוקים*',
};

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

  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState(1);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [image, setImage] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([empty()]);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ url: string; slug: string } | null>(null);
  const [err, setErr] = useState('');

  // WhatsApp message template
  const [waOpening, setWaOpening] = useState(WA_DEFAULTS.opening);
  const [waNotes, setWaNotes] = useState(WA_DEFAULTS.notes);
  const [waGroup, setWaGroup] = useState(WA_DEFAULTS.group);
  const [waClosing, setWaClosing] = useState(WA_DEFAULTS.closing);
  const [tracked, setTracked] = useState(true);
  const [codes, setCodes] = useState<string[]>([]);

  const [stats, setStats] = useState<StatMenu[] | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    setTheme(t);
    try {
      const tpl = JSON.parse(localStorage.getItem('yummio-wa-tpl') || '{}');
      if (tpl.opening !== undefined) setWaOpening(tpl.opening);
      if (tpl.notes !== undefined) setWaNotes(tpl.notes);
      if (tpl.group !== undefined) setWaGroup(tpl.group);
      if (tpl.closing !== undefined) setWaClosing(tpl.closing);
    } catch {}
    const saved = sessionStorage.getItem('yummio-admin-pass');
    if (saved) { setPass(saved); verify(saved); }
  }, []);

  function saveTpl(next: Partial<{ opening: string; notes: string; group: string; closing: string }>) {
    const tpl = { opening: waOpening, notes: waNotes, group: waGroup, closing: waClosing, ...next };
    try { localStorage.setItem('yummio-wa-tpl', JSON.stringify(tpl)); } catch {}
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('yummio-theme', next); } catch {}
    setTheme(next);
  }

  async function verify(p: string) {
    setAuthErr('');
    try {
      const r = await fetch(BP + '/api/check', { method: 'POST', headers: { 'x-admin-pass': p } });
      if (r.ok) { setAuthed(true); sessionStorage.setItem('yummio-admin-pass', p); loadStats(p); }
      else setAuthErr('סיסמה שגויה');
    } catch { setAuthErr('שגיאת חיבור'); }
  }

  async function markSent(slug: string) {
    try {
      await fetch(BP + '/api/sent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass }, body: JSON.stringify({ slug }) });
      loadStats();
    } catch {}
  }

  async function loadStats(p = pass) {
    setStatsBusy(true);
    try {
      const r = await fetch(BP + '/api/stats', { method: 'POST', headers: { 'x-admin-pass': p } });
      const d = await r.json();
      setStats(d.menus || []);
    } catch { setStats([]); }
    finally { setStatsBusy(false); }
  }

  function update(i: number, field: keyof Recipe, val: string) {
    setRecipes((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    setRecipes((rs) => {
      const j = i + dir; if (j < 0 || j >= rs.length) return rs;
      const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c;
    });
  }
  function restoreFromMsg(i: number) {
    setRecipes((rs) => rs.map((r, idx) => idx === i ? { ...r, title: r.msgTitle || r.title, desc: r.msgDesc || r.desc } : r));
  }
  function resetComposer() {
    setTitle(''); setIntro(''); setImage(''); setRecipes([empty()]);
    setDate(todayISO()); setMessage(1); setBulk(''); setResult(null); setErr('');
  }
  function goPublishNew() { resetComposer(); setView('publish'); setNavOpen(false); }

  async function loadMenu(slug: string, keepSlug: boolean) {
    setBusy('טוען תפריט...');
    try {
      const r = await fetch(`${BP}/api/menu?slug=${encodeURIComponent(slug)}`, { headers: { 'x-admin-pass': pass } });
      const d = await r.json(); if (!d.menu) throw new Error('not found');
      const m = d.menu;
      setTitle(m.title || ''); setIntro(m.intro || ''); setImage(m.image || '');
      setRecipes(m.recipes?.length ? m.recipes.map(norm) : [empty()]);
      setTracked(m.tracked !== false); setCodes([]);
      if (keepSlug) { setDate(m.date); setMessage(m.message); } else { setDate(todayISO()); setMessage(1); }
      setResult(null); setErr(''); setBulk(''); setView('publish'); setNavOpen(false);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  // מושך מהאתר: עוקב אחרי bit.ly (resolve), כותרת נקייה, תיאור, ושם בעל המתכון
  async function fetchMeta(i: number) {
    const url = recipes[i].url.trim(); if (!url) return;
    setBusy(`מושך מתכון ${i + 1}...`);
    try {
      const r = await fetch(`${BP}/api/scrape?url=${encodeURIComponent(url)}`, { headers: { 'x-admin-pass': pass } });
      const d = await r.json(); if (d.error) throw new Error(d.error);
      setRecipes((rs) => rs.map((rec, idx) => idx === i ? {
        ...rec,
        url: tracked ? (d.finalUrl || rec.url) : rec.url, // במצב "מקורי" שומרים את הקישור כמו שהוא
        image: d.image || rec.image,
        title: d.title || rec.title,
        desc: d.desc || rec.desc,
        author: d.author || rec.author,
      } : rec));
    } catch (e) { setErr(`משיכת מתכון ${i + 1} נכשלה: ${e}`); }
    finally { setBusy(''); }
  }
  async function fetchAll() {
    for (let i = 0; i < recipes.length; i++) if (recipes[i].url.trim()) await fetchMeta(i);
  }

  // מפענח הודעת וואטסאפ: שם (עם כוכביות/אימוג'י) + תיאור + קישור
  function parseBulk() {
    const lines = bulk.split('\n');
    const rows: Recipe[] = [];
    let groupLink = '';
    for (let k = 0; k < lines.length; k++) {
      const m = lines[k].match(/(https?:\/\/[^\s]+)/);
      if (!m) continue;
      const url = m[1];
      // קישור וואטסאפ = הצטרפות/שיתוף קבוצה, לא מתכון
      if (/chat\.whatsapp\.com|wa\.me|whatsapp\.com\/(channel|invite)/i.test(url)) {
        if (!groupLink) groupLink = url;
        continue;
      }
      const block: string[] = [];
      for (let j = k - 1; j >= 0; j--) {
        const ln = lines[j].trim();
        if (!ln) break;
        if (/https?:\/\//.test(ln)) break;
        block.unshift(ln);
      }
      let name = (block[0] || '').replace(/\*/g, '').replace(/^[\s\d#.\)\-–—•*️⃣]+/u, '').trim();
      const desc = block.slice(1).join(' ').replace(/\*/g, '').trim();
      if (!name) name = '(ללא שם)';
      const r = empty();
      r.url = url; r.title = name; r.desc = desc; r.msgTitle = name; r.msgDesc = desc;
      rows.push(r);
    }
    if (groupLink) { setWaGroup(groupLink); saveTpl({ group: groupLink }); }
    if (rows.length) { setRecipes(rows); setBulk(''); setErr(''); }
    else if (groupLink) { setBulk(''); setErr('זוהה רק קישור קבוצה (נשמר). לא נמצאו מתכונים.'); }
    else setErr('לא נמצאו קישורים בטקסט');
  }

  async function publish() {
    setErr(''); setResult(null); setCodes([]); setBusy('מפרסם...');
    try {
      const r = await fetch(BP + '/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ date, message, title, intro, image, tracked, recipes }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'failed');
      setResult({ url: d.url, slug: d.slug });
      setCodes(d.codes || []);
      loadStats();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  // ---- WhatsApp message ----
  const [copied, setCopied] = useState(false);
  async function copyMessage() {
    const text = buildWaMessage();
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; }
    } catch { /* ניפול ל-fallback */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* */ }
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else setErr('ההעתקה נכשלה — סמנו את הטקסט והעתיקו ידנית.');
  }

  function buildWaMessage(): string {
    // origin כולל את נתיב הבסיס (למשל https://yummio.co.il/menus) כדי שכל קישורי הוואטסאפ יעבדו
    const origin = (typeof window !== 'undefined' ? window.location.origin : '') + BP;
    const slug = `${date}-${message}`;
    const sameSlug = !!result && result.slug === slug;
    const list = recipes.filter((r) => r.title && r.url);
    const block = list.map((r, i) => {
      const num = EMO[i] || `${i + 1}.`;
      const link = !tracked
        ? r.url // מצב "מקורי": משאירים את קישור bit.ly כמו שהוא
        : (sameSlug && codes[i] ? `${origin}/s/${codes[i]}` : `${origin}/go/${slug}/${i}/wa`);
      const lines = [`${num} *${r.title}*`];
      if (r.desc) lines.push(r.desc);
      lines.push(link);
      return lines.join('\n');
    }).join('\n\n');
    const parts: string[] = [`${origin}/menu/${slug}`];
    if (waOpening.trim()) parts.push(waOpening.trim());
    const ng = [waNotes.trim(), waGroup.trim()].filter(Boolean).join('\n');
    if (ng) parts.push(ng);
    if (block) parts.push(block);
    if (waClosing.trim()) parts.push(waClosing.trim());
    return parts.join('\n\n');
  }

  const totals = (() => {
    if (!stats) return null;
    const views = stats.reduce((s, m) => s + m.views, 0);
    const clicks = stats.reduce((s, m) => s + m.clicks, 0);
    let top = { title: '—', total: 0 };
    for (const m of stats) for (const r of m.recipes) if (r.total > top.total) top = { title: r.title, total: r.total };
    return { views, clicks, ctr: views ? Math.round((clicks / views) * 100) : 0, menus: stats.length, top };
  })();

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

  return (
    <div className="studio">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`studio-nav${navOpen ? ' open' : ''}`}>
        <div className="studio-logo"><span className="dot">🍳</span> Yumm<b>io</b> <span className="studio-logo-sub">Studio</span></div>
        <nav className="studio-navlist">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item${view === n.id ? ' active' : ''}`} onClick={() => { setView(n.id); setNavOpen(false); }}>
              <span className="nav-ico">{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="studio-nav-foot">
          <button className="nav-item" onClick={toggleTheme}><span className="nav-ico">{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</button>
          <a className="nav-item" href={`${BP}/`} target="_blank"><span className="nav-ico">↗</span> צפייה באתר</a>
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
        {stats && stats.length === 0 && <p className="admin-hint">אין תפריטים עדיין.</p>}
      </>
    );
  }

  function renderMenus() {
    const list = (stats || []).filter((m) => !menuQuery || m.title.includes(menuQuery) || m.slug.includes(menuQuery) || m.dateLabel.includes(menuQuery));
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
            {!!m.sends && <span className="stat-chip">🔁 {m.sends}{m.lastSent ? ` · ${m.lastSent}` : ''}</span>}
          </div>
        </div>
        <div className="menu-row-actions">
          <a className="admin-btn ghost sm" href={`${BP}/menu/${m.slug}`} target="_blank">פתח ↗</a>
          {withActions && <button className="admin-btn ghost sm" onClick={() => loadMenu(m.slug, false)}>שכפל</button>}
          {withActions && <button className="admin-btn ghost sm" onClick={() => loadMenu(m.slug, true)}>עריכה</button>}
          {withActions && <button className="admin-btn ghost sm" onClick={() => markSent(m.slug)}>סמן כנשלח</button>}
        </div>
      </div>
    );
  }

  function renderPublish() {
    return (
      <>
        <section className="admin-card">
          <div className="mode-row">
            <div>
              <strong style={{ fontSize: 15 }}>מצב קישורים</strong>
              <p className="admin-hint" style={{ marginTop: 4 }}>
                {tracked ? 'קישורים חדשים קצרים עם מעקב (וואטסאפ / עמוד)' : 'שמירת הקישורים המקוריים (bit.ly) — ללא מעקב'}
              </p>
            </div>
            <div className="mode-toggle">
              <button className={`mode-btn${tracked ? ' on' : ''}`} onClick={() => setTracked(true)}>מעקב</button>
              <button className={`mode-btn${!tracked ? ' on' : ''}`} onClick={() => setTracked(false)}>מקורי</button>
            </div>
          </div>
        </section>

        <section className="admin-card">
          <h2 className="admin-h2">פרטי התפריט</h2>
          <div className="admin-row3">
            <label>תאריך<input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>מספר הודעה<input className="admin-input" type="number" min={1} value={message} onChange={(e) => setMessage(Number(e.target.value))} /></label>
            <label>כותרת<input className="admin-input" placeholder="לדוגמה: תפריט הערב" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          </div>
          <label style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            מבוא (טקסט שמופיע מתחת לכותרת)
            <textarea className="admin-input" rows={2} style={{ marginTop: 6 }} placeholder="טקסט פתיחה קצר ומזמין..." value={intro} onChange={(e) => setIntro(e.target.value)} />
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
          <textarea className="admin-input" rows={4} placeholder="הדביקו את כל טקסט ההודעה (גם הודעה ישנה עם bit.ly — נזהה ונמיר אוטומטית)..." value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <div className="admin-actions">
            <button className="admin-btn ghost" onClick={parseBulk}>חלץ מתכונים מהטקסט</button>
            <button className="admin-btn ghost" onClick={fetchAll}>משוך הכול מהאתר (תמונה/כותרת/בעל מתכון)</button>
          </div>
          <p className="admin-hint" style={{ marginTop: 8 }}>טיפ: "חלץ" שומר את הטקסט מההודעה; "משוך מהאתר" מחליף לגרסת האתר (אפשר להחזיר לכל מתכון בנפרד).</p>
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
                {(r.msgTitle || r.msgDesc) && <button className="admin-btn ghost sm" onClick={() => restoreFromMsg(i)} title="החזר טקסט מההודעה">↻ מההודעה</button>}
                <button className="admin-del" onClick={() => setRecipes((rs) => rs.filter((_, idx) => idx !== i))} aria-label="מחיקה" style={{ marginInlineStart: 'auto' }}>✕</button>
              </div>
              <div className="admin-recipe-grid">
                <label className="full">קישור המתכון
                  <div className="admin-inline">
                    <input className="admin-input" placeholder="https://... (גם bit.ly)" value={r.url} onChange={(e) => update(i, 'url', e.target.value)} />
                    <button className="admin-btn sm" onClick={() => fetchMeta(i)}>משוך</button>
                  </div>
                </label>
                <label className="full">כותרת<input className="admin-input" value={r.title} onChange={(e) => update(i, 'title', e.target.value)} /></label>
                <label className="full">תיאור<input className="admin-input" value={r.desc} onChange={(e) => update(i, 'desc', e.target.value)} /></label>
                <label className="full">בעל המתכון (אופציונלי)<input className="admin-input" placeholder="נמשך אוטומטית" value={r.author} onChange={(e) => update(i, 'author', e.target.value)} /></label>
                <label>זמן הכנה (אופ׳)<input className="admin-input" placeholder="15 דק׳" value={r.time} onChange={(e) => update(i, 'time', e.target.value)} /></label>
                <label>רמה (אופ׳)<input className="admin-input" placeholder="קל" value={r.level} onChange={(e) => update(i, 'level', e.target.value)} /></label>
                <label className="full">קישור תמונה<input className="admin-input" placeholder="מתמלא אוטומטית במשיכה" value={r.image} onChange={(e) => update(i, 'image', e.target.value)} /></label>
              </div>
              {r.image && <img className="admin-preview" src={r.image} alt="" />}
            </div>
          ))}
          <button className="admin-btn big publish-inline" onClick={publish} disabled={!!busy}>🚀 פרסם תפריט</button>
          {busy && <p className="admin-busy" style={{ textAlign: 'center', marginTop: 10 }}>{busy}</p>}
          {err && <p className="admin-err" style={{ textAlign: 'center', marginTop: 10 }}>{err}</p>}
          {result && <p className="admin-ok" style={{ textAlign: 'center', marginTop: 10 }}>✅ פורסם! יופיע באתר תוך ~30 שניות: <a href={result.url} target="_blank">{result.url}</a></p>}
        </section>

        <section className="admin-card" style={{ borderColor: 'var(--brand)' }}>
          <h2 className="admin-h2">📲 הודעת וואטסאפ מוכנה</h2>
          <p className="admin-hint" style={{ marginBottom: 10 }}>הטקסטים הקבועים נשמרים אצלכם. הקישורים פעילים אחרי פרסום התפריט.</p>
          <div className="admin-recipe-grid">
            <label className="full">פתיח<textarea className="admin-input" rows={2} value={waOpening} onChange={(e) => { setWaOpening(e.target.value); saveTpl({ opening: e.target.value }); }} /></label>
            <label className="full">הערות קבועות<textarea className="admin-input" rows={2} value={waNotes} onChange={(e) => { setWaNotes(e.target.value); saveTpl({ notes: e.target.value }); }} /></label>
            <label className="full">קישור הקבוצה<input className="admin-input" placeholder="https://chat.whatsapp.com/..." value={waGroup} onChange={(e) => { setWaGroup(e.target.value); saveTpl({ group: e.target.value }); }} /></label>
            <label className="full">סיום<textarea className="admin-input" rows={2} value={waClosing} onChange={(e) => { setWaClosing(e.target.value); saveTpl({ closing: e.target.value }); }} /></label>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: '14px 0 6px' }}>הטקסט המלא להעתקה:</h3>
          <textarea className="admin-input" rows={14} readOnly value={buildWaMessage()} onClick={(e) => (e.target as HTMLTextAreaElement).select()} style={{ fontFamily: 'inherit' }} />
          <button className="admin-btn big" style={{ marginTop: 10, width: '100%' }} onClick={copyMessage}>{copied ? '✓ הועתק!' : '📋 העתק את כל ההודעה'}</button>
        </section>
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
              <a className="admin-link" href={`${BP}/menu/${m.slug}`} target="_blank">פתח ↗</a>
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
          <div className="set-row"><span>אתר חי</span><a className="admin-link" href={`${BP}/`} target="_blank">yummio.co.il/menus ↗</a></div>
          <div className="set-row"><span>מאגר קוד</span><a className="admin-link" href="https://github.com/sfiras/yummio" target="_blank">GitHub ↗</a></div>
          <div className="set-row"><span>פריסה</span><a className="admin-link" href="https://vercel.com/firassomreh-6317s-projects/yummio" target="_blank">Vercel ↗</a></div>
          <div className="set-row"><span>אנליטיקס</span><a className="admin-link" href="https://analytics.google.com" target="_blank">GA4 ↗</a></div>
        </div>
        <div className="admin-card">
          <h2 className="admin-h2">תזכורות</h2>
          <p className="admin-hint">• טוקן GitHub פג בערך ב-30 ביולי 2026 — לחדש אז.</p>
          <p className="admin-hint" style={{ marginTop: 6 }}>• העלאת תמונות + מעקב שליחה חוזרת — בקרוב.</p>
          <p className="admin-hint" style={{ marginTop: 6 }}>• AdSense עדיין לא חובר.</p>
        </div>
        <button className="admin-btn ghost" onClick={() => { sessionStorage.removeItem('yummio-admin-pass'); location.reload(); }}>התנתק</button>
      </>
    );
  }
}
