// Themen-Kacheln der Tagesinhalte (Unterhaltung, Wissen, Alltag): holt den Dienst „tagesinhalt“ (daily/1) für den gezeigten Tag.
// Mini-Reiter je Art; in jedem Reiter ‹ › (vergangene Tage), ☆ Favorit (Kopie im Browser), „+ Aufgabe“ (→ Mein Daily); Reiter „Favoriten“.
// Ein Anbieter je Thema: themenAnbieter('unterhaltung') usw.; zusatz: { dienst, art } holt für denselben Tag einen weiteren Dienst als eigene Art
// (Wissen: „andiesemtag“ → Reiter „An diesem Tag“; fällt er aus, bleiben die übrigen Reiter).
import { set } from '../core/board.js';
import { kachelOpt, kachelOptSpeichern, favoriten, saveFavoriten, tasks, saveTasks } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { dienst } from '../dienste/client.js';
import { berlinDay } from '../core/util.js';
import { kachel, THEMEN, ART, artInhalt, favEintrag, tagPlus, mitZusatz } from '../adapter/tagesinhalt.js';

// Gemeinsam für Themen-Kacheln und den Spartipp in „Finanzen“: Favorit an/aus (Kopie im Browser) und „+ Aufgabe“ (→ Mein Daily)
export function favUmschalten(art, env) {
  const datum = env.daten.datum, i = favoriten.findIndex(f => f.art === art && f.datum === datum);
  if (i >= 0) favoriten.splice(i, 1); else { const f = favEintrag(art, env); if (f) favoriten.push(f); }
  saveFavoriten();
  document.dispatchEvent(new CustomEvent('daily:favoriten'));   // andere Kacheln (z. B. Alltag zeigt Spartipp-Favoriten) zeichnen neu
}
export const istFavorit = (art, env) => !!(env && env.daten && favoriten.some(f => f.art === art && f.datum === env.daten.datum));
export function alsAufgabe(art, env, knopf) {
  const a = artInhalt(art, env.daten.inhalt);
  if (!a) return;
  tasks.unshift({ id: 't' + Date.now().toString(36), text: `${ART[art].name}: ${a.kurz}`.slice(0, 140), done: false });
  saveTasks();
  document.dispatchEvent(new CustomEvent('daily:aufgaben'));   // „Mein Daily“ zeichnet neu
  if (knopf) { knopf.innerHTML = '✓<span class="ti-lang"> Aufgabe</span>'; setTimeout(() => { if (knopf.isConnected) knopf.innerHTML = '+<span class="ti-lang"> Aufgabe</span>'; }, 1500); }
}

export function themenAnbieter(id, { zusatz = null } = {}) {
  const thema = THEMEN[id];
  let env = null, heuteEnv = null, datum = null, loesung = false, fehler = null;
  const opt = () => kachelOpt(id, {});
  const paint = () => set(id, kachel(id, env, { favoriten, loesung, opt: opt() }));

  async function zeige(d) {
    try {
      const [t, z] = await Promise.all([dienst('tagesinhalt', { datum: d }), zusatz ? dienst(zusatz.dienst, { datum: d }).catch(() => null) : null]);
      const r = zusatz ? mitZusatz(t, zusatz.art, z) : t;
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
      // Favorit einer Art aus einer anderen Kachel (Spartipp → Finanzen): dort öffnen
      if (!thema.arten.includes(a)) { document.dispatchEvent(new CustomEvent('daily:tagesinhalt', { detail: { art: a, datum: d } })); return; }
      kachelOptSpeichern(id, { reiter: a });
      zeige(d).catch(() => {});
      return;
    }
    if (!env) return;
    const ti = b.dataset.ti;
    if (ti === 'zurueck') zeige(tagPlus(datum, -1)).catch(() => {});
    else if (ti === 'vor') zeige(tagPlus(datum, 1)).catch(() => {});
    else if (ti === 'loesung') { loesung = true; paint(); }
    else if (ti === 'fav' && ART[art]) favUmschalten(art, env);
    else if (ti === 'aufgabe' && ART[art]) alsAufgabe(art, env, b);
  });
  document.addEventListener('daily:favoriten', () => { if (env || fehler) paint(); });

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
