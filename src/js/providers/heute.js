// Tagesinhalte (Dienste „tagesinhalt“ und „andiesemtag“) für drei Bereiche (seit 0.49.0, docs/konzept/themen.md):
// „Heute“ (Rätsel zum Mitmachen, Lachen – mit ‹ ›, ältere Tage „nachgeholt“), „Entdecken“ (Sprache, Zeitreise, Welt, Kultur) und „Mehr → Alltag“
// (Rezept, Gesundheit, Tech, Beziehung, Spartipp). Entdecken und Alltag zeigen immer heute; ein gemerkter Inhalt eines anderen Tags
// öffnet dort mit „vom 1.10.“ und „zu heute“ (Entscheidung 03.10.2026). Fällt „andiesemtag“ aus, bleiben die übrigen Inhalte.
import { set, zeige as zeigeBereich } from '../core/oberflaeche.js';
import { favoriten, saveFavoriten } from '../core/store.js';
import { dienst } from '../dienste/client.js';
import { berlinDay } from '../core/util.js';
import { heuteBereich, entdeckenBereich, alltagRubrik, gemerktReiter, favEintrag, tagPlus, mitZusatz, ortVon, datumText, mitmachRaetsel } from '../adapter/tagesinhalt.js';
import { spiel, spielSetzen } from '../core/spielstand.js';
import { kaestchen, teilenText, teilen } from '../core/teilen.js';

const tage = new Map();                    // Datum → Antwort (mit „An diesem Tag“)
let heute = null, fehler = null;           // heute: heutiges Datum laut Dienst
const tag = { heute: null, entdecken: null, mehr: null };   // gezeigter Tag je Bereich (null = heute)
let loesung = false, rezeptSeite = 1;
const envVon = b => tage.get(tag[b] || heute) || null;

function zeichne() {
  if (!heute && fehler) { set('heute', { state: 'error', kleinReiter: [], bereichKopf: '' }); set('entdecken', { state: 'error', kleinReiter: [] }); }
  else {
    const h = envVon('heute');
    set('heute', heuteBereich(h, { favoriten, loesung, spiel: h ? spiel(h.daten.datum, 'raetsel') : undefined }));
    set('entdecken', entdeckenBereich(envVon('entdecken'), { favoriten, vom: !!tag.entdecken }));
    set('alltag', alltagRubrik(envVon('mehr'), { favoriten, rezeptSeite, vom: !!tag.mehr }));
  }
  set('gemerkt', gemerktReiter(favoriten));
}

// d = null: heute (laut Browser); „heute“ ist dann der gelieferte Tag – so passen Anzeige und Speicher auch bei schief gehender Uhr
async function holeTag(d) {
  const fuerHeute = !d;
  d = d || berlinDay();
  if (tage.has(d) && d !== heute) return tage.get(d);   // vergangene Tage ändern sich nicht
  const [t, z] = await Promise.all([dienst('tagesinhalt', { datum: d }), dienst('andiesemtag', { datum: d }).catch(() => null)]);
  const env = mitZusatz(t, 'geschichte', z);
  tage.set(env.daten.datum, env);
  if (fuerHeute || !heute) heute = env.daten.datum;
  return env;
}
// Einen Bereich auf einen Tag stellen (null = heute) und zeichnen
async function stelle(bereich, d) {
  try { await holeTag(d || heute); tag[bereich] = d && d !== heute ? d : null; fehler = null; }
  catch (e) { fehler = e; }
  if (bereich === 'heute') loesung = false;
  if (bereich === 'mehr') rezeptSeite = 1;
  zeichne();
}

function merken(art, bereich) {
  const env = envVon(bereich); if (!env) return;
  const i = favoriten.findIndex(f => f.art === art && f.datum === env.daten.datum);
  if (i >= 0) favoriten.splice(i, 1); else { const f = favEintrag(art, env); if (f) favoriten.push(f); }
  saveFavoriten();
  zeichne();
}

document.addEventListener('click', e => {
  const b = e.target.closest('#tile-heute [data-ti], #tile-entdecken [data-ti], #tile-mehr [data-ti], #tile-mehr [data-aktion^="fav:"]');
  if (!b || b.disabled) return;
  const bereich = b.closest('[data-bereich]').dataset.bereich;
  // Mehr → Gemerkt: den Inhalt in seinem Bereich öffnen (Heute: an dem Tag; Entdecken/Alltag: mit „vom …“)
  if (b.dataset.aktion) {
    const [art, d] = b.dataset.aktion.slice(4).split('|'), o = ortVon(art);
    tag[o.bereich] = d;
    zeigeBereich(o.bereich, o.rubrik, o.thema);
    stelle(o.bereich, d);
    return;
  }
  const ti = b.dataset.ti, env = envVon(bereich);
  if (ti === 'fav') merken(b.dataset.art, bereich);
  else if (ti === 'heute') stelle(bereich, null);
  else if (!env) return;
  else if (ti === 'zurueck') stelle('heute', tagPlus(env.daten.datum, -1));
  else if (ti === 'vor') stelle('heute', tagPlus(env.daten.datum, 1));
  else if (ti === 'loesung') { loesung = true; zeichne(); }
  else if (ti === 'antwort' || ti === 'tipp' || ti === 'teilen') raetsel(ti, env, b);
  else if (ti === 'rezeptseite') { rezeptSeite = rezeptSeite === 2 ? 1 : 2; zeichne(); }
});

// Rätsel zum Mitmachen: Antwort wählen, Tipp zeigen, Ergebnis teilen – Spielstand nur im Browser (core/spielstand.js)
async function raetsel(ti, env, knopf) {
  const r = env.daten.inhalt.raetsel, d = env.daten.datum;
  if (!mitmachRaetsel(r)) return;
  const s = spiel(d, 'raetsel');
  if (ti === 'antwort' && !s.geloest && !s.versuche.includes(knopf.dataset.antwort)) {
    s.versuche.push(knopf.dataset.antwort);
    if (knopf.dataset.antwort === r.antwort) { s.geloest = true; s.nachgeholt = d < env.daten.heute; }   // wie der Datumsblock: älter als heute laut Dienst
  } else if (ti === 'tipp' && !s.geloest) s.tipps = Math.min(s.tipps + 1, (r.tipps || []).length);
  else if (ti === 'teilen' && s.geloest) {
    const text = teilenText({ tag: datumText(d), format: 'Rätsel', ergebnis: kaestchen(s.versuche, r.antwort), tipps: s.tipps, adresse: location.origin + '/' });
    const was = await teilen(text);
    const meldung = { geteilt: '✓ Geteilt', kopiert: '✓ Kopiert', fehler: 'Teilen geht hier nicht' }[was];
    if (meldung && knopf.isConnected) { knopf.textContent = meldung; setTimeout(() => { if (knopf.isConnected) knopf.textContent = 'Teilen'; }, 2500); }
    return;
  } else return;
  spielSetzen(d, 'raetsel', s);
  zeichne();
}

// Beim Laden: heute holen (nach Mitternacht wird so der neue Tag „heute“); zurückgeblätterte oder geöffnete Tage bleiben
export async function load() {
  try { await holeTag(null); fehler = null; } catch (e) { fehler = e; }
  for (const b of Object.keys(tag)) if (tag[b] === heute) tag[b] = null;
  await Promise.all(Object.values(tag).filter(Boolean).map(d => holeTag(d).catch(() => null)));
  zeichne();
  if (fehler && !heute) throw fehler;
}

// „Gemerkt“ unter Mehr braucht keinen Abruf – gleich beim Start zeigen (auch wenn DAILY mit #mehr geöffnet wird)
set('gemerkt', gemerktReiter(favoriten));

// Gehört zu drei Bereichen: lädt, sobald einer davon sichtbar ist
export default { id: 'heute', name: 'Tagesinhalte', bereich: ['heute', 'entdecken', 'mehr'], every: 30 * 60e3, load };
