'use client';
import { useEffect, useRef, useState } from 'react';
import { BP } from '@/lib/base';

const DRAFT_KEY = 'yummio-composer-draft'; // שמירה אוטומטית של הטיוטה בדפדפן

type Recipe = {
  url: string; image: string; title: string; desc: string; time: string; level: string;
  author: string; msgTitle: string; msgDesc: string;
};
type StatRecipe = { i: number; title: string; wa: number; page: number; total: number };
type StatMenu = {
  slug: string; title: string; dateLabel: string; message: number; draft?: boolean; waText?: string;
  views: number; waTotal: number; pageTotal: number; clicks: number; ctr: number;
  sends?: number; lastSent?: string | null; recipes: StatRecipe[];
};
type View = 'overview' | 'publish' | 'menus' | 'stats' | 'links' | 'settings';

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
  { id: 'links', label: 'קיצור קישורים', icon: '🔗' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️' },
];

// ממיר טקסט וואטסאפ לתצוגה מקדימה: *מודגש*, קישורים, ושמירת שורות
function waNodes(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*[^*\n]+\*)|(https?:\/\/[^\s]+)/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1].slice(1, -1)}</strong>);
    else if (m[2]) out.push(<a key={k++} href={m[2]} target="_blank" rel="noopener" style={{ color: '#027eb5', wordBreak: 'break-all' }}>{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function AdminPage() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [uiVer, setUiVer] = useState<'v1' | 'v2'>('v1'); // גרסת עיצוב: קלאסי (V1) / חדש (V2)
  const [view, setView] = useState<View>('overview');
  const [navOpen, setNavOpen] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState(1);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [image, setImage] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([empty()]);
  const [bulk, setBulk] = useState('');
  const [waText, setWaText] = useState(''); // הודעת הוואטסאפ ששויכה לעמוד (מה ששלחת)
  const [msgModal, setMsgModal] = useState<{ title: string; text: string } | null>(null); // חלון "הצג הודעה"
  const [hasDraft, setHasDraft] = useState(false); // האם קיימת טיוטה שמורה בדפדפן
  const [editingSlug, setEditingSlug] = useState(''); // אם עורכים תפריט קיים — ה-slug שלו (כדי לא להזהיר על דריסה עצמית)
  const skipSave = useRef(true); // מדלגים על השמירה הראשונה (mount) כדי לא לדרוס טיוטה קיימת
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ url: string; slug: string; draft?: boolean } | null>(null);
  const [err, setErr] = useState('');

  // WhatsApp message template
  const [waOpening, setWaOpening] = useState(WA_DEFAULTS.opening);
  const [waNotes, setWaNotes] = useState(WA_DEFAULTS.notes);
  const [waGroup, setWaGroup] = useState(WA_DEFAULTS.group);
  const [waClosing, setWaClosing] = useState(WA_DEFAULTS.closing);
  const [tracked, setTracked] = useState(true);
  const [codes, setCodes] = useState<string[]>([]);

  const [stats, setStats] = useState<StatMenu[] | null>(null);
  const [trend, setTrend] = useState<{ date: string; clicks: number; views: number }[]>([]);
  const [statsBusy, setStatsBusy] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');

  // מקצר קישורים
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [lastShort, setLastShort] = useState('');
  const [links, setLinks] = useState<{ code: string; u: string; t: string; ts: number; short: string; wa: number; page: number; other: number; total: number }[]>([]);

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    setTheme(t);
    const u = (document.documentElement.getAttribute('data-ui') as 'v1' | 'v2') || 'v1';
    setUiVer(u);
    try {
      const tpl = JSON.parse(localStorage.getItem('yummio-wa-tpl') || '{}');
      if (tpl.opening !== undefined) setWaOpening(tpl.opening);
      if (tpl.notes !== undefined) setWaNotes(tpl.notes);
      if (tpl.group !== undefined) setWaGroup(tpl.group);
      if (tpl.closing !== undefined) setWaClosing(tpl.closing);
    } catch {}
    const saved = sessionStorage.getItem('yummio-admin-pass');
    if (saved) { setPass(saved); verify(saved); }
    try { setHasDraft(!!localStorage.getItem(DRAFT_KEY)); } catch {}
  }, []);

  // שמירה אוטומטית של הטיוטה בדפדפן (מדלגים על ה-mount הראשון כדי לא לדרוס טיוטה קיימת)
  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ date, message, title, intro, image, recipes, waText, tracked }));
      setHasDraft(true);
    } catch {}
  }, [date, message, title, intro, image, recipes, waText, tracked]);

  // טעינת רשימת הקישורים המקוצרים כשנכנסים למסך
  useEffect(() => { if (authed && view === 'links') loadLinks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authed, view]);

  // סגירת חלון ההודעה עם Escape
  useEffect(() => {
    if (!msgModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMsgModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [msgModal]);

  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return;
      if (d.date) setDate(d.date); if (d.message) setMessage(d.message);
      setTitle(d.title || ''); setIntro(d.intro || ''); setImage(d.image || '');
      setRecipes(Array.isArray(d.recipes) && d.recipes.length ? d.recipes.map(norm) : [empty()]);
      setWaText(d.waText || ''); if (typeof d.tracked === 'boolean') setTracked(d.tracked);
      setResult(null); setErr(''); setView('publish'); setNavOpen(false);
    } catch {}
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasDraft(false);
  }

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
  function toggleUi() {
    const next = uiVer === 'v2' ? 'v1' : 'v2';
    document.documentElement.setAttribute('data-ui', next);
    try { localStorage.setItem('yummio-ui', next); } catch {}
    setUiVer(next);
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
      setTrend(d.trend || []);
    } catch { setStats([]); }
    finally { setStatsBusy(false); }
  }

  async function loadLinks() {
    try {
      const r = await fetch(BP + '/api/links', { method: 'POST', headers: { 'x-admin-pass': pass } });
      const d = await r.json();
      setLinks(d.links || []);
    } catch { setLinks([]); }
  }
  async function shortenLink() {
    const url = linkUrl.trim();
    if (!url) { setErr('הדביקו קישור.'); return; }
    setBusy('מקצר קישור...'); setLastShort('');
    try {
      const r = await fetch(BP + '/api/shorten-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ url, label: linkLabel }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'failed');
      setLastShort(d.short); setLinkUrl(''); setLinkLabel(''); setErr('');
      await loadLinks();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
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
    setTitle(''); setIntro(''); setImage(''); setRecipes([empty()]); setEditingSlug('');
    setDate(todayISO()); setMessage(1); setBulk(''); setWaText(''); setResult(null); setErr('');
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
      setTracked(m.tracked !== false); setCodes([]); setWaText(m.waText || '');
      if (keepSlug) { setDate(m.date); setMessage(m.message); setEditingSlug(slug); } else { setDate(todayISO()); setMessage(1); setEditingSlug(''); }
      setResult(null); setErr(''); setBulk(''); setView('publish'); setNavOpen(false);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  // מחיקת תפריט לגמרי (מוחק את הקובץ מהמאגר)
  async function deleteMenu(slug: string) {
    if (!window.confirm(`למחוק לגמרי את "${slug}"?\nהעמוד יוסר מהאתר. פעולה זו אינה הפיכה.`)) return;
    setBusy('מוחק תפריט...');
    try {
      const r = await fetch(BP + '/api/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ slug }),
      });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'failed');
      setErr(''); await loadStats();
    } catch (e) { setErr(`מחיקה נכשלה: ${e}`); }
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
  async function parseBulk() {
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
    if (!rows.length) {
      setErr(groupLink ? 'זוהה רק קישור קבוצה (נשמר). לא נמצאו מתכונים.' : 'לא נמצאו קישורים בטקסט');
      return;
    }
    if (bulk.trim()) setWaText(bulk.trim()); // שומרים את ההודעה ששויכה לעמוד
    setRecipes(rows); setBulk(''); setErr('');

    // משיכה אוטומטית של תמונות מהאתר (עוקב אחרי bit.ly). שומרים כותרת/תיאור מההודעה.
    for (let i = 0; i < rows.length; i++) {
      const url = rows[i].url.trim(); if (!url) continue;
      setBusy(`מושך תמונה ${i + 1}/${rows.length}...`);
      try {
        const r = await fetch(`${BP}/api/scrape?url=${encodeURIComponent(url)}`, { headers: { 'x-admin-pass': pass } });
        const d = await r.json(); if (d.error) continue;
        setRecipes((rs) => rs.map((rec, idx) => idx === i ? {
          ...rec,
          url: tracked ? (d.finalUrl || rec.url) : rec.url,
          image: d.image || rec.image,
          author: d.author || rec.author,
          title: rec.title || d.title,
          desc: rec.desc || d.desc,
        } : rec));
      } catch { /* ממשיכים למתכון הבא */ }
    }
    setBusy('');
  }

  async function publish(asDraft = false) {
    // הגנה מפני דריסה בשוגג: אם כבר קיים תפריט לאותו תאריך+הודעה ולא זה שאנחנו עורכים — מאשרים במפורש
    const targetSlug = `${date}-${message}`;
    const collides = !!stats?.some((s) => s.slug === targetSlug);
    if (collides && targetSlug !== editingSlug) {
      const existing = stats?.find((s) => s.slug === targetSlug);
      const ok = window.confirm(`⚠️ כבר קיים תפריט לתאריך ${date} · הודעה ${message}${existing?.title ? ` ("${existing.title}")` : ''}.\nפרסום ידרוס אותו לצמיתות ויאפס את הנתונים שלו.\n\nלהמשיך? (לתפריט חדש — שנו את מספר ההודעה)`);
      if (!ok) return;
    }
    setErr(''); setResult(null); setCodes([]); setBusy(asDraft ? 'שומר טיוטה...' : 'מפרסם...');
    try {
      const r = await fetch(BP + '/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ date, message, title, intro, image, tracked, draft: asDraft, waText, recipes }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'failed');
      setResult({ url: d.url, slug: d.slug, draft: !!d.draft });
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
          <button className="nav-item" onClick={toggleUi}><span className="nav-ico">🎨</span> עיצוב: {uiVer === 'v2' ? 'חדש (V2)' : 'קלאסי (V1)'}</button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div title="החלפת עיצוב" style={{ display: 'flex', gap: 2, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 3 }}>
              <button onClick={() => { if (uiVer !== 'v1') toggleUi(); }} style={{ border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, padding: '6px 12px', borderRadius: 9, background: uiVer === 'v1' ? 'var(--brand)' : 'transparent', color: uiVer === 'v1' ? '#fff' : 'var(--ink-soft)' }}>V1</button>
              <button onClick={() => { if (uiVer !== 'v2') toggleUi(); }} style={{ border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, padding: '6px 12px', borderRadius: 9, background: uiVer === 'v2' ? 'var(--brand)' : 'transparent', color: uiVer === 'v2' ? '#fff' : 'var(--ink-soft)' }}>V2</button>
            </div>
            {view !== 'publish' && <button className="admin-btn sm" onClick={goPublishNew}>+ תפריט חדש</button>}
          </div>
        </header>
        <div className="studio-content">
          {view === 'overview' && renderOverview()}
          {view === 'publish' && renderPublish()}
          {view === 'menus' && renderMenus()}
          {view === 'stats' && renderStats()}
          {view === 'links' && renderLinks()}
          {view === 'settings' && renderSettings()}
        </div>
      </div>
      {msgModal && (
        <div onClick={() => setMsgModal(null)} role="dialog" aria-modal="true" aria-label="הודעת וואטסאפ" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', color: 'var(--ink)', borderRadius: 16, padding: 18, width: 'min(560px,100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'var(--shadow-hover)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 15 }}>📄 הודעת וואטסאפ · {msgModal.title}</strong>
              <button className="admin-btn ghost sm" onClick={() => setMsgModal(null)}>✕</button>
            </div>
            <div style={{ background: '#efeae2', borderRadius: 14, padding: '14px 12px', overflow: 'auto', flex: 1 }}>
              {msgModal.text ? (
                <div style={{ background: '#d9fdd3', color: '#111b21', borderRadius: 12, padding: '8px 10px 6px', maxWidth: '92%', marginInlineStart: 'auto', fontSize: 14.5, lineHeight: 1.55 }}>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{waNodes(msgModal.text)}</div>
                </div>
              ) : <p className="admin-hint">אין הודעה שמורה לעמוד זה. (נשמרת אוטומטית כשמדביקים הודעה ומפרסמים)</p>}
            </div>
            {msgModal.text && <button className="admin-btn big" onClick={() => { navigator.clipboard?.writeText(msgModal.text).catch(() => {}); }}>📋 העתק</button>}
          </div>
        </div>
      )}
    </div>
  );

  function renderOverview() {
    if (uiVer === 'v2') {
      const kpis = [
        { ic: '👁', label: 'צפיות', val: totals ? totals.views.toLocaleString() : '—', tint: 'var(--brand)' },
        { ic: '🔗', label: 'קליקים', val: totals ? totals.clicks.toLocaleString() : '—', tint: '#06b6d4' },
        { ic: '📈', label: 'CTR', val: totals ? totals.ctr + '%' : '—', tint: '#22c55e' },
        { ic: '🗂️', label: 'תפריטים', val: totals ? String(totals.menus) : '—', tint: '#f59e0b' },
      ];
      const tmax = Math.max(1, ...trend.map((t) => Math.max(t.clicks, t.views)));
      return (
        <>
          <div style={{ overflow: 'hidden', borderRadius: 24, padding: '22px', marginBottom: 18, background: 'linear-gradient(120deg, var(--brand), color-mix(in srgb, var(--brand) 55%, var(--brand-2)))', color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>Yummio Studio</div>
            <div style={{ fontSize: 25, fontWeight: 900, marginTop: 4, letterSpacing: '-0.5px' }}>מה מכינים היום?</div>
            <div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>הדביקו הודעת וואטסאפ ותפריט נבנה תוך שניות.</div>
            <button onClick={goPublishNew} style={{ marginTop: 14, background: '#fff', color: 'var(--brand-ink)', border: 'none', borderRadius: 14, padding: '11px 20px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>➕ תפריט חדש</button>
          </div>
          <div className="kpi-grid">
            {kpis.map((k) => (
              <div className="kpi" key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 20, background: `color-mix(in srgb, ${k.tint} 16%, transparent)` }}>{k.ic}</div>
                <div>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-val" style={{ fontSize: 24 }}>{k.val}</div>
                </div>
              </div>
            ))}
          </div>
          {trend.length > 0 && (
            <div className="admin-card" style={{ marginTop: 16 }}>
              <div className="admin-h2-row"><h2 className="admin-h2">מגמה · 14 ימים</h2></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 72 }}>
                {trend.map((t) => (
                  <div key={t.date} title={`${t.date} · ${t.clicks} קליקים`} style={{ flex: 1, background: t.clicks >= tmax ? 'var(--brand)' : 'color-mix(in srgb, var(--brand) 22%, transparent)', borderRadius: 5, height: `${Math.round((t.clicks / tmax) * 100)}%`, minHeight: 3 }} />
                ))}
              </div>
            </div>
          )}
          {hasDraft && (
            <div className="admin-inline" style={{ gap: 10, marginTop: 14 }}>
              <button className="admin-btn ghost sm" onClick={restoreDraft}>↩︎ שחזר טיוטה אחרונה</button>
              <button className="admin-btn ghost sm" onClick={clearDraft}>נקה</button>
            </div>
          )}
          <div className="admin-h2-row" style={{ marginTop: 20 }}>
            <h2 className="admin-h2">תפריטים אחרונים</h2>
            <button className="admin-btn ghost sm" onClick={() => loadStats()}>רענן</button>
          </div>
          {stats && stats.slice(0, 5).map((m) => menuRow(m))}
          {stats && stats.length === 0 && <p className="admin-hint">אין תפריטים עדיין.</p>}
        </>
      );
    }
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
        {hasDraft && (
          <div className="admin-inline" style={{ gap: 10, marginTop: 10 }}>
            <button className="admin-btn ghost sm" onClick={restoreDraft}>↩︎ שחזר טיוטה אחרונה (נשמר אוטומטית)</button>
            <button className="admin-btn ghost sm" onClick={clearDraft}>נקה</button>
          </div>
        )}
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
          <div className="menu-row-title"><strong>{m.title}</strong>{m.draft && <span style={{ marginInlineStart: 6, padding: '1px 8px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 800 }}>טיוטה</span>} <span className="admin-hint">· {m.dateLabel} · הודעה {m.message}</span></div>
          <div className="menu-row-chips">
            <span className="stat-chip">👁 {m.views}</span>
            <span className="stat-chip">🔗 {m.clicks}</span>
            <span className="stat-chip">CTR {m.ctr}%</span>
            {!!m.sends && <span className="stat-chip">🔁 {m.sends}{m.lastSent ? ` · ${m.lastSent}` : ''}</span>}
          </div>
        </div>
        <div className="menu-row-actions">
          <a className="admin-btn ghost sm" href={`${BP}/menu/${m.slug}`} target="_blank">פתח ↗</a>
          <button className="admin-btn ghost sm" onClick={() => setMsgModal({ title: m.title, text: m.waText || '' })}>📄 הודעת וואטסאפ</button>
          {withActions && <button className="admin-btn ghost sm" onClick={() => loadMenu(m.slug, false)}>שכפל</button>}
          {withActions && <button className="admin-btn ghost sm" onClick={() => loadMenu(m.slug, true)}>עריכה</button>}
          {withActions && <button className="admin-btn ghost sm" onClick={() => markSent(m.slug)}>סמן כנשלח</button>}
          {withActions && <button className="admin-btn ghost sm" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => deleteMenu(m.slug)}>🗑 מחק</button>}
        </div>
      </div>
    );
  }

  function renderPublish() {
    // אם כבר קיים תפריט עם אותו תאריך+הודעה => זהו עדכון לפוסט קיים (הקובץ יידרס)
    const isUpdate = !!stats?.some((s) => s.slug === `${date}-${message}`);
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
            <button className="admin-btn ghost" onClick={parseBulk}>חלץ מתכונים + תמונות</button>
            <button className="admin-btn ghost" onClick={fetchAll}>משוך הכל מהאתר (תמונה/כותרת/בעל מתכון)</button>
          </div>
          <p className="admin-hint" style={{ marginTop: 8 }}>"חלץ מתכונים + תמונות" מפענח את ההודעה ומושך אוטומטית תמונה + שם בעל/ת המתכון לכל מתכון (עוקב אחרי bit.ly), ושומר את הכותרות/תיאורים מההודעה. "משוך הכל מהאתר" מחליף גם את הכותרת/תיאור לגרסת האתר.</p>
          <label className="full" style={{ marginTop: 12, display: 'block' }}>
            <strong style={{ fontSize: 14 }}>📄 הודעת הוואטסאפ ששלחת (נשמרת עם העמוד, ותוצג בכפתור בכל תפריט)</strong>
            <textarea className="admin-input" rows={4} style={{ marginTop: 6 }} placeholder="נשמר אוטומטית מההדבקה למעלה — אפשר גם להדביק/לערוך כאן את הנוסח המדויק ששלחת." value={waText} onChange={(e) => setWaText(e.target.value)} />
          </label>
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
          {isUpdate && <p className="admin-hint" style={{ textAlign: 'center', marginTop: 8, color: 'var(--brand)' }}>♻️ קיים תפריט לתאריך+הודעה האלה — פרסום/עדכון יחליף אותו.</p>}
          <div className="admin-inline" style={{ gap: 10 }}>
            <button className="admin-btn ghost big" style={{ flex: 1 }} onClick={() => publish(true)} disabled={!!busy}>💾 שמור טיוטה (תצוגה מקדימה)</button>
            <button className="admin-btn big publish-inline" style={{ flex: 1 }} onClick={() => publish(false)} disabled={!!busy}>{isUpdate ? '♻️ פרסם / עדכן live' : '🚀 פרסם live'}</button>
          </div>
          {busy && <p className="admin-busy" style={{ textAlign: 'center', marginTop: 10 }}>{busy}</p>}
          {err && <p className="admin-err" style={{ textAlign: 'center', marginTop: 10 }}>{err}</p>}
          {result && <p className="admin-ok" style={{ textAlign: 'center', marginTop: 10 }}>{result.draft ? '💾 נשמר כטיוטה (~30 שניות). תצוגה מקדימה: ' : '✅ פורסם! יופיע באתר תוך ~30 שניות: '}<a href={result.url} target="_blank">{result.url}</a></p>}
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
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: '14px 0 6px' }}>תצוגה מקדימה (כמו בוואטסאפ):</h3>
          <div style={{ background: '#efeae2', borderRadius: 14, padding: '14px 12px' }}>
            <div style={{ background: '#d9fdd3', color: '#111b21', borderRadius: 12, padding: '8px 10px 6px', maxWidth: '92%', marginInlineStart: 'auto', boxShadow: '0 1px 1px rgba(0,0,0,.12)', fontSize: 14.5, lineHeight: 1.55 }}>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{waNodes(buildWaMessage())}</div>
              <div style={{ textAlign: 'end', fontSize: 11, color: '#667781', marginTop: 3 }}>{new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} ✓✓</div>
            </div>
          </div>
          <button className="admin-btn big" style={{ marginTop: 10, width: '100%' }} onClick={copyMessage}>{copied ? '✓ הועתק!' : '📋 העתק את כל ההודעה'}</button>
          <details style={{ marginTop: 8 }}>
            <summary className="admin-hint" style={{ cursor: 'pointer' }}>טקסט גולמי (להעתקה ידנית)</summary>
            <textarea className="admin-input" rows={10} readOnly value={buildWaMessage()} onClick={(e) => (e.target as HTMLTextAreaElement).select()} style={{ fontFamily: 'inherit', marginTop: 6 }} />
          </details>
        </section>
      </>
    );
  }

  function renderStats() {
    return (
      <>
        <div className="admin-h2-row">
          <h2 className="admin-h2">סטטיסטיקות</h2>
          <button className="admin-btn ghost sm" onClick={() => loadStats()}>רענן</button>
        </div>
        {trend.length > 0 && (() => {
          const max = Math.max(1, ...trend.map((t) => Math.max(t.clicks, t.views)));
          const totalClicks = trend.reduce((s, t) => s + t.clicks, 0);
          const totalViews = trend.reduce((s, t) => s + t.views, 0);
          return (
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-h2-row">
                <h2 className="admin-h2">מגמה יומית · 14 ימים</h2>
                <span className="admin-hint">קליקים <b>{totalClicks}</b> · צפיות <b>{totalViews}</b></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 12 }}>
                {trend.map((t) => (
                  <div key={t.date} title={`${t.date} · קליקים ${t.clicks} · צפיות ${t.views}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 100 }}>
                      <div style={{ flex: 1, maxWidth: 12, background: 'var(--brand)', borderRadius: '4px 4px 0 0', height: `${Math.round((t.clicks / max) * 100)}%`, minHeight: t.clicks ? 3 : 0 }} />
                      <div style={{ flex: 1, maxWidth: 12, background: 'var(--line)', borderRadius: '4px 4px 0 0', height: `${Math.round((t.views / max) * 100)}%`, minHeight: t.views ? 3 : 0 }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--ink-soft)' }}>{t.date.slice(8)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--ink-soft)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--brand)', borderRadius: 2, marginInlineEnd: 4 }} />קליקים</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--line)', borderRadius: 2, marginInlineEnd: 4 }} />צפיות</span>
              </div>
            </div>
          );
        })()}
        <h2 className="admin-h2" style={{ marginTop: 4 }}>לפי הודעה</h2>
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

  function renderLinks() {
    return (
      <>
        <section className="admin-card">
          <h2 className="admin-h2">🔗 קצר קישור חדש</h2>
          <p className="admin-hint" style={{ marginBottom: 10 }}>חלופה ל-bit.ly — קישור קצר משלכם עם ספירת קליקים (וואטסאפ / עמוד / סה״כ). מתאים לכל הודעה: ספר, הצטרפות לקבוצה, מבצע.</p>
          <label className="full" style={{ display: 'block' }}>הקישור המלא<input className="admin-input" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></label>
          <label className="full" style={{ display: 'block', marginTop: 8 }}>תווית (אופציונלי)<input className="admin-input" placeholder="למשל: מכירת הספר" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} /></label>
          <button className="admin-btn big" style={{ marginTop: 10, width: '100%' }} onClick={shortenLink} disabled={!!busy}>✂️ קצר וצור קישור מעקב</button>
          {lastShort && (
            <div className="admin-ok" style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={lastShort} target="_blank">{lastShort}</a>
              <button className="admin-btn ghost sm" onClick={() => navigator.clipboard?.writeText(lastShort).catch(() => {})}>📋 העתק</button>
            </div>
          )}
          {busy && <p className="admin-busy" style={{ textAlign: 'center', marginTop: 8 }}>{busy}</p>}
          {err && <p className="admin-err" style={{ textAlign: 'center', marginTop: 8 }}>{err}</p>}
        </section>

        <div className="admin-h2-row" style={{ marginTop: 18 }}>
          <h2 className="admin-h2">הקישורים שלי ({links.length})</h2>
          <button className="admin-btn ghost sm" onClick={loadLinks}>רענן</button>
        </div>
        {links.length === 0 && <p className="admin-hint">עדיין אין קישורים מקוצרים.</p>}
        {links.map((l) => (
          <div className="menu-row" key={l.code}>
            <div className="menu-row-main">
              <div className="menu-row-title"><strong>{l.t || l.short}</strong></div>
              <div className="admin-hint" style={{ wordBreak: 'break-all' }}>{l.short} → {l.u}</div>
              <div className="menu-row-chips" style={{ marginTop: 6 }}>
                <span className="stat-chip">📱 וואטסאפ: <b>{l.wa}</b></span>
                <span className="stat-chip">🖥 עמוד: <b>{l.page}</b></span>
                <span className="stat-chip">🌐 אחר: <b>{l.other}</b></span>
                <span className="stat-chip">🔗 סה״כ: <b>{l.total}</b></span>
              </div>
            </div>
            <div className="menu-row-actions">
              <button className="admin-btn ghost sm" onClick={() => navigator.clipboard?.writeText(l.short).catch(() => {})}>📋 העתק</button>
              <a className="admin-btn ghost sm" href={l.short} target="_blank">פתח ↗</a>
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
