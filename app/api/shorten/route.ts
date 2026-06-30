import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// מקצר קישורים דרך bitly ומוסיף תגית "whatsapp". אם אין טוקן — מחזיר ריק והדשבורד נופל חזרה לקישורי /go.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-pass') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = process.env.BITLY_TOKEN;
  if (!token) return NextResponse.json({ links: [], note: 'no-bitly-token' });

  let body: { items?: { title: string; long_url: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const out: { title: string; short: string }[] = [];

  for (const it of body.items || []) {
    let short = it.long_url;
    try {
      const r = await fetch('https://api-ssl.bitly.com/v4/shorten', {
        method: 'POST', headers: auth, body: JSON.stringify({ long_url: it.long_url, tags: ['whatsapp'] }),
      });
      const d = await r.json();
      if (d.link) short = d.link;
      // הוספת התגית (חלק מהתוכניות לא תומכות ב-tags ב-shorten — מנסים גם ב-PATCH)
      if (d.id) {
        try {
          await fetch(`https://api-ssl.bitly.com/v4/bitlinks/${encodeURIComponent(d.id)}`, {
            method: 'PATCH', headers: auth, body: JSON.stringify({ tags: ['whatsapp'] }),
          });
        } catch { /* best effort */ }
      }
    } catch { /* נשארים עם הקישור הארוך */ }
    out.push({ title: it.title, short });
  }

  return NextResponse.json({ links: out });
}
