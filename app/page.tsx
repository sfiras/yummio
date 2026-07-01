import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yummio · מתכונים טעימים כל יום',
  description: 'אוסף מתכונים חדש ומפנק — מגיע ישירות בוואטסאפ, כל יום.',
};

// דף הבית = עמוד נחיתה זמני (לא מציג תפריט). התפריטים נגישים דרך קישורים ייעודיים
// שנשלחים בוואטסאפ: /menu/<slug>. הניהול: /admin.
export default function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        gap: 18,
      }}
    >
      <div
        style={{
          fontSize: 44,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: 'var(--ink, #0f172a)',
        }}
      >
        <span style={{ color: 'var(--brand, #2563eb)' }}>🍳 Yumm</span>io
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--ink, #0f172a)' }}>
        מתכונים חדשים כל יום 🧡
      </h1>

      <p
        style={{
          maxWidth: 460,
          fontSize: 17,
          lineHeight: 1.7,
          color: 'var(--ink-soft, #475569)',
          margin: 0,
        }}
      >
        אנחנו משתפים אוסף מתכונים טעימים, קלים ומהירים — ישירות בקבוצות הוואטסאפ,
        מדי יום. הצטרפו אלינו כדי לקבל את המתכונים הראשונים.
      </p>

      <span
        style={{
          marginTop: 8,
          fontSize: 14,
          color: 'var(--ink-soft, #64748b)',
          opacity: 0.85,
        }}
      >
        © {new Date().getFullYear()} Yummio
      </span>
    </main>
  );
}
