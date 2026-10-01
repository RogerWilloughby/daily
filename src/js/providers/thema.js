// Themen-Kacheln der Tagesinhalte (Unterhaltung, Wissen, Alltag): holt den Dienst „tagesinhalt“ (daily/1) für den gezeigten Tag.
// Mini-Reiter je Art; in jedem Reiter ‹ › (vergangene Tage), ☆ Favorit (Kopie im Browser), „+ Aufgabe“ (→ Mein Daily); Reiter „Favoriten“.
// Ein Anbieter je Thema: themenAnbieter('unterhaltung') usw.
import { set } from '../core/board.js';
import { kachelOpt, kachelOptSpeichern, favoriten, saveFavoriten, tasks, saveTasks } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { dienst } from '../dienste/client.js';
import { berlinDay } from '../core/util.js';
import { kachel, THEMEN, ART, artInhalt, favEintrag, tagPlus } from '../adapter/tagesinhalt.js';

export function themenAnbieter(id) {
  const thema = THEMEN[id];
  let env = null, heuteEnv = null, datum = null, loesung = false, fehler = null;
  const opt = () => kachelOpt(id, {});
  const paint = () => set(id, kachel(id, env, { favoriten, loesung, opt: opt() }));

  async function zeige(d) {
    try {
      const r = await dienst('tagesinhalt', { datum: d });
      env = r; datum = r.daten.datum; loesung = false; fehler = null;
      if (datum === r.daten.heute) heuteEnv = r;
    } catch (e) { fehler = e; if (!env) env = null; }
    paint();
    if (fehler && !env) throw fehler;
  }

  // Bedienung in der Kachel: ‹ › Datum, ☆ Favorit, + Aufgabe, Lösung zeigen, Favorit öffnen
  document.addEventListener('click', e => {
    const kachelEl = e.target.closest(`#tile-${id}`); if (!kachelEl) return;
    const b = e.target.closest('[data-ti], [data-aktion]'); if (!b || b.disabled) return;
    const aktiv = (kachelEl.querySelector('[data-kr][aria-selected="true"]') || {}).dataset || {};
    const art = aktiv.kr;
    if (b.dataset.aktion && b.dataset.aktion.startsWith('fav:')) {
      const [a, d] = b.dataset.aktion.slice(4).split('|');
      kachelOptSpeichern(id, { reiter: a });
      zeige(d).catch(() => {});
      return;
    }
    if (!env) return;
    const ti = b.dataset.ti;
    if (ti === 'zurueck') zeige(tagPlus(datum, -1)).catch(() => {});
    else if (ti === 'vor') zeige(tagPlus(datum, 1)).catch(() => {});
    else if (ti === 'loesung') { loesung = true; paint(); }
    else if (ti === 'fav' && ART[art]) {
      const i = favoriten.findIndex(f => f.art === art && f.datum === datum);
      if (i >= 0) favoriten.splice(i, 1); else { const f = favEintrag(art, env); if (f) favoriten.push(f); }
      saveFavoriten(); paint();
    } else if (ti === 'aufgabe' && ART[art]) {
      const a = artInhalt(art, env.daten.inhalt);
      if (!a) return;
      tasks.unshift({ id: 't' + Date.now().toString(36), text: `${ART[art].name}: ${a.kurz}`.slice(0, 140), done: false });
      saveTasks();
      document.dispatchEvent(new CustomEvent('daily:aufgaben'));   // „Mein Daily“ zeichnet neu
      b.innerHTML = '✓<span class="ti-lang"> Aufgabe</span>'; setTimeout(() => { if (b.isConnected) b.innerHTML = '+<span class="ti-lang"> Aufgabe</span>'; }, 1500);
    }
  });

  // Einstellungsfenster: Reiter ein/aus
  kachelEinstellungen(id, {
    felder: () => [{ typ: 'titel', label: 'Reiter anzeigen' },
      ...[...thema.arten, 'favoriten'].map(a => ({ typ: 'check', key: a, label: a === 'favoriten' ? 'Favoriten' : ART[a].name, wert: opt()[a] !== false }))],
    speichern: w => { kachelOptSpeichern(id, Object.fromEntries([...thema.arten, 'favoriten'].map(a => [a, !!w[a]]))); paint(); }
  });

  // Beim Laden: heute; ist man zurückgeblättert, bleibt der Tag (ein neuer Tag nach Mitternacht wird beim nächsten Laden „heute“)
  async function load() {
    const heute = berlinDay();
    await zeige(!datum || (env && datum === env.daten.heute) ? heute : datum);
  }
  return { provider: { id, name: thema.name, every: 30 * 60e3, load }, heute: () => heuteEnv };
}
