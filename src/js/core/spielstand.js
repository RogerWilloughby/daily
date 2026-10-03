// Spielstand zum Mitmachen (Phase 2, seit 0.51.0): je Tag und Format, nur in diesem Browser – nichts geht an DAILY.
// Form (Version 1): { v: 1, tage: { '2026-10-03': { raetsel: { versuche: ['Ein Hai', 'Ein Kamm'], tipps: 1, geloest: true, nachgeholt: false } } } }
// versuche = gewählte Antworten in Reihenfolge; geloest = die letzte war richtig; nachgeholt = an einem späteren Tag gelöst.
// Das Album (Phase 3) liest daraus, an welchen Tagen irgendein Format gelöst ist.
export const SPIELSTAND_VERSION = 1;
const KEY = 'daily-spielstand';

// rein: gespeicherten Text lesen – unbekannte oder kaputte Stände ergeben einen leeren Stand (spätere Versionen wandeln hier um)
export function spielstandLesen(text) {
  try { const s = JSON.parse(text); if (s && s.v === SPIELSTAND_VERSION && s.tage && typeof s.tage === 'object') return s; } catch (e) { /* leer */ }
  return { v: SPIELSTAND_VERSION, tage: {} };
}

let stand = spielstandLesen((() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })());
const schreiben = () => { try { localStorage.setItem(KEY, JSON.stringify(stand)); return true; } catch (e) { return false; } };

// Stand eines Formats an einem Tag (leer, wenn noch nicht gespielt)
export const spiel = (datum, format) => ({ versuche: [], tipps: 0, geloest: false, nachgeholt: false, ...((stand.tage[datum] || {})[format] || {}) });
export function spielSetzen(datum, format, wert) {
  stand.tage[datum] = { ...(stand.tage[datum] || {}), [format]: wert };
  return schreiben();
}
// Tage, an denen irgendein Format gelöst ist (fürs Album)
export const geloesteTage = () => Object.keys(stand.tage).filter(d => Object.values(stand.tage[d]).some(f => f && f.geloest)).sort();
// nur für Tests
export function _setzeStand(s) { stand = spielstandLesen(JSON.stringify(s)); }
