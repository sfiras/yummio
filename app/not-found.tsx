import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="wrap" style={{ padding: '70px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>אופס — התפריט לא נמצא 🍽️</h1>
        <p style={{ marginTop: 10, color: 'var(--ink-soft)' }}>אולי הקישור פג. חזרו לתפריט האחרון:</p>
        <p style={{ marginTop: 18 }}>
          <a className="btn-go" href="/" style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 14 }}>
            לתפריט של היום ←
          </a>
        </p>
      </main>
      <Footer />
    </>
  );
}
