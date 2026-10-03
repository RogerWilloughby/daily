// Bereich „Heute“ (seit 0.47.0, ersetzt die Themen-Kacheln Unterhaltung, Wissen, Alltag): holt die Dienste „tagesinhalt“ und
// „andiesemtag“ einmal je gezeigtem Tag und stellt sie über den Adapter dar (adapter/tagesinhalt.js → heuteBereich).
// Bedienung: ‹ › blättert (ältere Tage „nachgeholt“), „zu heute“, Lösung zeigen, Rezept Seite 1/2, ☆ Merken (→ Mehr · Gemerkt).
// Fällt „andiesemtag“ aus, bleiben die übrigen Inhalte.
import { set, zeige as zeigeBereich } from '../core/oberflaeche.js';
import { favoriten, saveFavoriten } from '../core/store.js';
import { dienst } from '../dienste/client.js';
import { berlinDay } from '../core/util.js';
import { heuteBereich, gemerktReiter, favEintrag, tagPlus, mitZusatz, gruppeVon, GRUPPEN } from '../adapter/tagesinhalt.js';

let env = null, datum = null, loesung = false, rezeptSeite = 1, fehler = null;

const zeichne = () => {
  set('heute', env || !fehler ? heuteBereich(env, { favoriten, loesung, rezeptSeite }) : { state: 'error', kleinReiter: [], bereichKopf: '' });
  set('gemerkt', gemerktReiter(favoriten));
};

async function holeTag(d) {
  try {
    const [t, z] = await Promise.all([dienst('tagesinhalt', { datum: d }), dienst('andiesemtag', { datum: d }).catch(() => null)]);
    env = mitZusatz(t, 'geschichte', z); datum = env.daten.datum; loesung = false; rezeptSeite = 1; fehler = null;
  } catch (e) { fehler = e; }
  zeichne();
  if (fehler && !env) throw fehler;
}

function merken(art) {
  if (!env) return;
  const i = favoriten.findIndex(f => f.art === art && f.datum === env.daten.datum);
  if (i >= 0) favoriten.splice(i, 1); else { const f = favEintrag(art, env); if (f) favoriten.push(f); }
  saveFavoriten();
  zeichne();
}

document.addEventListener('click', e => {
  const b = e.target.closest('#tile-heute [data-ti], #tile-mehr [data-aktion^="fav:"]');
  if (!b || b.disabled) return;
  // Mehr → Gemerkt: den gemerkten Tag unter „Heute“ öffnen, in der Gruppe der Art
  if (b.dataset.aktion) {
    const [art, d] = b.dataset.aktion.slice(4).split('|'), g = gruppeVon(art), grp = GRUPPEN.find(x => x.id === g);
    zeigeBereich('heute', g, grp && grp.arten.length > 1 ? art : null);
    holeTag(d).catch(() => {});
    return;
  }
  const ti = b.dataset.ti;
  if (ti === 'fav') { merken(b.dataset.art); return; }
  if (!env) return;
  if (ti === 'zurueck') holeTag(tagPlus(datum, -1)).catch(() => {});
  else if (ti === 'vor') holeTag(tagPlus(datum, 1)).catch(() => {});
  else if (ti === 'heute') holeTag(env.daten.heute).catch(() => {});
  else if (ti === 'loesung') { loesung = true; zeichne(); }
  else if (ti === 'rezeptseite') { rezeptSeite = rezeptSeite === 2 ? 1 : 2; zeichne(); }
});

// Beim Laden: heute; ist man zurückgeblättert, bleibt der Tag (ein neuer Tag nach Mitternacht wird beim nächsten Laden „heute“)
export async function load() {
  await holeTag(!datum || (env && datum === env.daten.heute) ? berlinDay() : datum);
}

export default { id: 'heute', name: 'Tagesinhalte', every: 30 * 60e3, load };
