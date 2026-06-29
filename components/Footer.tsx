export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="wrap">
        <a className="logo" href="/"><span className="dot">🍳</span> Yumm<b>io</b></a>
        <p>כל המתכונים הטעימים במקום אחד · מתעדכן בכל יום</p>
        <p style={{ marginTop: 10 }}>© {year} Yummio · <a href="#">תנאי שימוש</a> · <a href="#">פרטיות</a></p>
      </div>
    </footer>
  );
}
