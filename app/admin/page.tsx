'use client';
import { useEffect, useState } from 'react';

type Recipe = { url: string; image: string; title: string; desc: string; time: string; level: string };

const empty = (): Recipe => ({ url: '', image: '', title: '', desc: '', time: '', level: 'קל' });
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

export default function AdminPage() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');

  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState(1);
  const [title, setTitle] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([empty()]);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('yummio-admin-pass');
    if (saved) { setPass(saved); verify(saved); }
  }, []);

  async function verify(p: string) {
    setAuthErr('');
    try {
      const r = await fetch('/api/check', { method: 'POST', headers: { 'x-admin-pass': p } });
      if (r.ok) { setAuthed(true); sessionStorage.setItem('yummio-admin-pass', p); }
      else setAuthErr('كلمة السر غير صحيحة');
    } catch { setAuthErr('خطأ بالاتصال'); }
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
    setBusy(`جلب وصفة ${i + 1}...`);
    try {
      const r = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`, { headers: { 'x-admin-pass': pass } });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setRecipes((rs) => rs.map((rec, idx) => idx === i ? {
        ...rec,
        image: d.image || rec.image,
        title: rec.title || d.title || '',
        desc: rec.desc || d.desc || '',
      } : rec));
    } catch (e) { setErr(`فشل جلب الوصفة ${i + 1}: ${e}`); }
    finally { setBusy(''); }
  }

  async function fetchAll() {
    for (let i = 0; i < recipes.length; i++) {
      if (recipes[i].url.trim() && !recipes[i].image) await fetchMeta(i);
    }
  }

  function parseBulk() {
    const urlRe = /(https?:\/\/[^\s]+)/g;
    const lines = bulk.split('\n');
    const rows: Recipe[] = [];
    for (const line of lines) {
      const urls = line.match(urlRe);
      if (!urls) continue;
      const url = urls[0];
      const name = line.replace(url, '').replace(/[•\-–—:]/g, ' ').trim();
      const r = empty();
      r.url = url;
      r.title = name;
      rows.push(r);
    }
    if (rows.length) { setRecipes(rows); setBulk(''); }
    else setErr('لم يتم العثور على روابط في النص');
  }

  async function publish() {
    setErr(''); setResult(null); setBusy('جاري النشر...');
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ date, message, title, recipes }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'failed');
      setResult({ url: d.url });
    } catch (e) { setErr(String(e)); }
    finally { setBusy(''); }
  }

  // ----- gate -----
  if (!authed) {
    return (
      <main className="admin-gate">
        <div className="admin-card" style={{ maxWidth: 360, width: '100%' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🍳 لوحة تحكم Yummio</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 16 }}>أدخل كلمة السر للدخول</p>
          <input className="admin-input" type="password" placeholder="كلمة السر" value={pass}
            onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify(pass)} />
          {authErr && <p className="admin-err">{authErr}</p>}
          <button className="admin-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => verify(pass)}>دخول</button>
        </div>
      </main>
    );
  }

  // ----- dashboard -----
  return (
    <main className="admin-wrap">
      <header className="admin-top">
        <h1>🍳 لوحة تحكم Yummio</h1>
        <a href="/" target="_blank" className="admin-link">عرض الموقع ↗</a>
      </header>

      <section className="admin-card">
        <h2 className="admin-h2">معلومات التفريت</h2>
        <div className="admin-row3">
          <label>التاريخ<input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>رقم الرسالة<input className="admin-input" type="number" min={1} value={message} onChange={(e) => setMessage(Number(e.target.value))} /></label>
          <label>العنوان<input className="admin-input" placeholder="مثلاً: تفريت المساء" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        </div>
        <p className="admin-hint">الرابط سيكون: <code>/menu/{date}-{message}</code></p>
      </section>

      <section className="admin-card">
        <h2 className="admin-h2">لصق سريع من رسالة واتساب</h2>
        <textarea className="admin-input" rows={4} placeholder="الصق نص الرسالة كاملاً (اسم الوصفة + الرابط بكل سطر)..." value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <div className="admin-actions">
          <button className="admin-btn ghost" onClick={parseBulk}>استخرج الوصفات من النص</button>
          <button className="admin-btn ghost" onClick={fetchAll}>جلب كل الصور والعناوين تلقائياً</button>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-h2-row">
          <h2 className="admin-h2">الوصفات ({recipes.length})</h2>
          <button className="admin-btn ghost sm" onClick={() => setRecipes((r) => [...r, empty()])}>+ إضافة وصفة</button>
        </div>

        {recipes.map((r, i) => (
          <div className="admin-recipe" key={i}>
            <div className="admin-recipe-head">
              <span className="admin-num">{i + 1}</span>
              <div className="admin-move">
                <button onClick={() => move(i, -1)} aria-label="أعلى">↑</button>
                <button onClick={() => move(i, 1)} aria-label="أسفل">↓</button>
              </div>
              <button className="admin-del" onClick={() => setRecipes((rs) => rs.filter((_, idx) => idx !== i))} aria-label="حذف">✕</button>
            </div>
            <div className="admin-recipe-grid">
              <label className="full">رابط الوصفة (yummio)
                <div className="admin-inline">
                  <input className="admin-input" placeholder="https://..." value={r.url} onChange={(e) => update(i, 'url', e.target.value)} />
                  <button className="admin-btn sm" onClick={() => fetchMeta(i)}>جلب</button>
                </div>
              </label>
              <label className="full">العنوان<input className="admin-input" value={r.title} onChange={(e) => update(i, 'title', e.target.value)} /></label>
              <label className="full">الوصف<input className="admin-input" value={r.desc} onChange={(e) => update(i, 'desc', e.target.value)} /></label>
              <label>الوقت<input className="admin-input" placeholder="15 דק׳" value={r.time} onChange={(e) => update(i, 'time', e.target.value)} /></label>
              <label>المستوى<input className="admin-input" placeholder="קל" value={r.level} onChange={(e) => update(i, 'level', e.target.value)} /></label>
              <label className="full">رابط الصورة<input className="admin-input" placeholder="يتعبأ تلقائياً عند الجلب" value={r.image} onChange={(e) => update(i, 'image', e.target.value)} /></label>
            </div>
            {r.image && <img className="admin-preview" src={r.image} alt="" />}
          </div>
        ))}
      </section>

      <div className="admin-publish-bar">
        {busy && <span className="admin-busy">{busy}</span>}
        {err && <span className="admin-err">{err}</span>}
        {result && (
          <span className="admin-ok">✅ تم النشر! سيظهر خلال ~30 ثانية: <a href={result.url} target="_blank">{result.url}</a></span>
        )}
        <button className="admin-btn big" disabled={!!busy} onClick={publish}>🚀 نشر التفريت</button>
      </div>
    </main>
  );
}
