// עזרי תאריך לפי שעון ישראל — לצורך אנליטיקה יומית.

/** תאריך היום (או של Date נתון) בפורמט YYYY-MM-DD לפי אזור הזמן של ישראל */
export function ilDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** מחזיר מערך של n הימים האחרונים (כולל היום), מהישן לחדש, בפורמט YYYY-MM-DD */
export function lastDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(ilDay(new Date(Date.now() - i * 86400000)));
  }
  return out;
}
