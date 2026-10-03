// Ergebnis teilen (Phase 2, seit 0.51.0): Text mit Kästchen je Versuch wie bei Wordle, dazu der Link zu DAILY
// (die aufgerufene Adresse – nach der eigenen Domain von selbst daily.craibotics.org). Über das Teilen-Menü des Geräts,
// sonst in die Zwischenablage. Es geht nichts an DAILY.

// rein: Kästchen je Versuch – falsche 🟥, die richtige 🟩
export const kaestchen = (versuche, richtig) => versuche.map(v => (v === richtig ? '🟩' : '🟥')).join('');

// rein: „DAILY Sa 3.10. · Rätsel 🟥🟩 · 💡1“ + Link in der nächsten Zeile
export function teilenText({ tag, format, ergebnis, tipps = 0, adresse }) {
  return `DAILY ${tag} · ${format} ${ergebnis}${tipps ? ' · 💡' + tipps : ''}\n${adresse}`;
}

// Teilen-Menü, sonst Zwischenablage. Ergebnis: 'geteilt' | 'kopiert' | 'abgebrochen' | 'fehler'
export async function teilen(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return 'geteilt'; }
    catch (e) { if (e && e.name === 'AbortError') return 'abgebrochen'; }
  }
  try { await navigator.clipboard.writeText(text); return 'kopiert'; } catch (e) { return 'fehler'; }
}
