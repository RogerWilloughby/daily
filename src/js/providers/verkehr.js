// Kachel „Verkehr“: Abfahrten (vorerst /api/transit, VVO – Umzug auf daily/1 folgt), Arbeitsweg Auto (Dienst „autobahn“, daily/1)
// und Tanken (Dienst „tanken“, daily/1). Die kleine Kachel zeigt eine Ansicht, der Umschalter wechselt sofort ohne Abruf.
// Start und Ziel des Arbeitswegs liegen nur in den Einstellungen dieses Browsers; der Dienst „autobahn“ bekommt nur die Autobahnen.
import { set } from '../core/board.js';
import { settings, saveSettings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { dienst, gespeichert, ortParams } from '../dienste/client.js';
import { ansicht as tankAnsicht, antwort as tankAntwort, sorteVon, SORTE_NAME, UMKREISE } from '../adapter/tanken.js';
import { ansicht as wegAnsicht, antwort as wegAntwort, strassenVon, FRAGE as WEG_FRAGE } from '../adapter/autobahn.js';
import { umschalter } from '../adapter/diagramm.js';
import { hm, getJson, esc } from '../core/util.js';

const ID = 'verkehr';
export const VERKEHR_STANDARD = { ansicht: 'abfahrten', umkreis: 5, strassen: '', start: null, ziel: null };
const WAHL = [['abfahrten', 'Abfahrten'], ['arbeitsweg', 'Arbeitsweg'], ['tanken', 'Tanken']];
const MAX_STRASSEN = 5;
const opt = () => kachelOpt(ID, VERKEHR_STANDARD);
const umkreis = () => (UMKREISE.includes(+opt().umkreis) ? +opt().umkreis : 5);
const tankParams = () => ({ ...ortParams(settings.place), umkreis: umkreis() });

const strassen = () => (strassenVon(opt().strassen) || []).slice(0, MAX_STRASSEN);
const wegParams = () => ({ strassen: strassen().join(',') });
const wegOrte = () => ({ start: opt().start, ziel: opt().ziel });

let ab = null, tk = null, tkFehler = null, aw = null;

// ---- Abfahrten (VVO über /api/transit) ----
const mins = iso => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
const inTxt = iso => { const m = mins(iso); return m === 0 ? 'jetzt' : `in ${m} min`; };
// „Tram 1“, „Bus 62“, „S1“ – Verkehrsmittel vor die Liniennummer
const lineLabel = d => /^[A-Z]/.test(d.line) ? d.line : /bus/i.test(d.mot) ? `Bus ${d.line}` : /tram/i.test(d.mot) ? `Tram ${d.line}` : d.line;
const kommende = () => (ab && ab.found ? ab.departures.filter(d => Date.parse(d.time) > Date.now() - 60000) : []);

function abfahrtenAnsicht() {
  if (!ab) return { kopf: 'Abfahrten', m: '', ms: '–', x: 'Die Abfahrten sind gerade nicht verfügbar.', liste: [], html: '<p>Die Abfahrten sind gerade nicht verfügbar.</p>' };
  if (!ab.found) {
    const t = `Haltestelle „${settings.stop}“ wurde nicht gefunden. In den Einstellungen der Kachel (Zahnrad) anpassen – vorerst nur Verkehrsverbund Oberelbe (Dresden und Umgebung).`;
    return { kopf: 'Haltestelle wählen', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
  }
  const deps = kommende(), first = deps[0];
  const rows = deps.slice(0, 12).map(d => `<div class="row"><dt>${esc(hm(d.time))}${d.delay > 0 ? ` <small class="vk-spaet">+${d.delay}</small>` : ''}</dt>` +
    `<dd>${esc(lineLabel(d))} → ${esc(d.direction)}${d.platform ? ` · <small>${esc(d.platform)}</small>` : ''}</dd></div>`).join('');
  return {
    kopf: `<b>${esc(ab.stop.name)}</b>`,
    m: first ? `${lineLabel(first)} ${inTxt(first.time)}` : 'Keine Abfahrt', ms: first ? (mins(first.time) ? `${mins(first.time)} min` : 'jetzt') : '–',
    x: deps.slice(0, 3).map(d => `${lineLabel(d)} → ${d.direction} ${inTxt(d.time)}`).join(' · ') || 'Gerade keine Abfahrten.',
    liste: deps.slice(0, 3).map(d => ({ d: inTxt(d.time).replace('in ', ''), t: `${lineLabel(d)} → ${d.direction}`,
      tip: `${hm(d.time)}${d.delay > 0 ? ` (+${d.delay} min)` : ''} · ${lineLabel(d)} → ${d.direction}${d.platform ? ' · ' + d.platform : ''}`, gruppe: 1 })),
    html: `<p class="vk-hinweis">${esc(ab.stop.name)} · Echtzeit, soweit verfügbar</p><dl class="kompakt">${rows || '<div class="row"><dd>In der nächsten Zeit keine Abfahrten.</dd></div>'}</dl>` +
      '<p class="vk-quelle">Quelle: VVO (Verkehrsverbund Oberelbe)</p>'
  };
}

// ---- Tanken (Dienst „tanken“) ----
function tankenAnsicht() {
  if (tkFehler && tkFehler.code === 'schluessel_fehlt' && !tk) {
    const t = 'Für Spritpreise braucht DAILY einen kostenlosen Tankerkönig-Schlüssel (Betreiber, einmalig): onboarding.tankerkoenig.de, dann Vercel-Variable TANKERKOENIG_API_KEY.';
    return { kopf: 'Tanken einrichten', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
  }
  if (tkFehler && tkFehler.code === 'nicht_unterstuetzt' && !tk) {
    const t = 'Spritpreise gibt es nur für Orte in Deutschland.';
    return { kopf: 'Tanken', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
  }
  return tankAnsicht(tk, sorteVon(settings.fuel));
}

// ---- Arbeitsweg Auto (Dienst „autobahn“) ----
function arbeitswegAnsicht() {
  if (!strassen().length) {
    const t = 'Im Zahnrad unter „Arbeitsweg“ die Autobahnen (z. B. A4, A13) sowie Start und Ziel eintragen. Start und Ziel bleiben in diesem Browser.';
    return { kopf: 'Arbeitsweg einrichten', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
  }
  return wegAnsicht(aw, wegOrte());
}
// Start/Ziel-Eingabe → Ort über den Dienst „ort“ (einmal beim Einrichten); nur das Ergebnis bleibt im Browser
async function ortVon(eingabe, alt) {
  const e = String(eingabe || '').trim();
  if (!e) return null;
  if (alt && alt.eingabe === e) return alt;
  try {
    const r = await dienst('ort', { q: e, land: 'DE' });
    const o = r.daten && r.daten.orte && r.daten.orte[0];
    return o ? { eingabe: e, name: o.name, region: o.region || null, lat: o.lat, lon: o.lon } : { eingabe: e, name: null };
  } catch (err) { return { eingabe: e, name: null }; }
}
const ortHilfe = o => (!o ? '' : o.name ? `→ ${o.name}${o.region ? ` (${o.region})` : ''}` : 'nicht gefunden – Ortsname oder Postleitzahl');

// ---- Kachel zusammensetzen ----
function zeichne() {
  const wahl = WAHL.some(([w]) => w === opt().ansicht) ? opt().ansicht : 'abfahrten';
  const teile = { abfahrten: abfahrtenAnsicht(), arbeitsweg: arbeitswegAnsicht(), tanken: tankenAnsicht() }, a = teile[wahl];
  set(ID, {
    // keine große Zeile: Kopf + Liste (wie Finanzen); am Handy die Kurzform ms
    state: ab || tk || aw ? 'live' : 'error', title: 'Verkehr', kopf: a.kopf, m: '', ms: a.ms, x: a.x, liste: a.liste,
    chart: `<div class="vk-fuss">${umschalter(wahl, WAHL)}</div>`,
    tabs: WAHL.map(([id, name]) => ({ id, name, html: teile[id].html })), startReiter: wahl,
    tag: wahl === 'tanken' && tk && tk.veraltet ? 'Stand ' + hm(tk.erstellt) : wahl === 'arbeitsweg' && aw && aw.veraltet ? 'Stand ' + hm(aw.erstellt) : ''
  });
}

export async function load() {
  const mitWeg = strassen().length > 0;
  if (!tk || (mitWeg && !aw)) { tk = tk || gespeichert('tanken', tankParams()) || null; aw = aw || (mitWeg && gespeichert('autobahn', wegParams())) || null; if (tk || aw) zeichne(); }
  const [a, t, w] = await Promise.all([
    getJson('/api/transit?stop=' + encodeURIComponent(settings.stop || 'Postplatz')).catch(e => e),
    dienst('tanken', tankParams()).catch(e => e),
    mitWeg ? dienst('autobahn', wegParams()).catch(e => e) : null
  ]);
  if (!(a instanceof Error)) ab = a;
  if (t instanceof Error) tkFehler = t; else { tk = t; tkFehler = null; }
  if (w && !(w instanceof Error)) aw = w;
  if (!mitWeg) aw = null;
  if (!ab && !tk && !aw) { zeichne(); throw (t instanceof Error ? t : a); }
  zeichne();
}

// Umschalter in der kleinen Kachel: dieselbe Einstellung wie „Beim Öffnen zeigen“ im Zahnrad-Reiter, sofort ohne Abruf
document.addEventListener('click', e => {
  const b = e.target.closest(`#tile-${ID} [data-mini-wahl]`); if (!b) return;
  kachelOptSpeichern(ID, { ansicht: b.dataset.miniWahl });
  zeichne();
});

// Frag DAILY
// Autobahn vor Bus/Bahn: „Autobahn“ enthält „bahn“
addAnswer(WEG_FRAGE, q => wegAntwort(q, aw, { ...wegOrte(), strassen: strassen() }));
addAnswer(/tank|benzin|diesel|sprit|super|\be10\b|\be5\b/i, q => tankAntwort(q, tk, settings.fuel));
addAnswer(/bus|bahn|tram|straßenbahn|strassenbahn|abfahrt|haltestelle|öpnv|oepnv/i, () => {
  if (!ab || !ab.found) return 'Die Abfahrten sind gerade nicht verfügbar.';
  const deps = kommende().slice(0, 4);
  return deps.length ? `${ab.stop.name}: ` + deps.map(d => `${lineLabel(d)} nach ${d.direction} ${inTxt(d.time)}`).join(', ') + '.' : `${ab.stop.name}: gerade keine Abfahrten.`;
});

// Einstellungen der Kachel (Zahnrad-Reiter)
kachelEinstellungen(ID, {
  felder: () => [
    { typ: 'select', key: 'ansicht', label: 'Kleine Kachel zeigt', wert: opt().ansicht, optionen: WAHL },
    { typ: 'titel', label: 'Abfahrten' },
    { typ: 'text', key: 'stop', label: 'Haltestelle', wert: settings.stop || '', platzhalter: 'z. B. Postplatz', hilfe: 'Vorerst Verkehrsverbund Oberelbe (Dresden und Umgebung); weitere Verbünde folgen.' },
    { typ: 'titel', label: 'Arbeitsweg (Auto)' },
    { typ: 'text', key: 'strassen', label: 'Autobahnen', wert: opt().strassen || '', platzhalter: 'z. B. A4, A13',
      hilfe: opt().strassen && !strassenVon(opt().strassen) ? 'Bitte als A4, A13 angeben.' : `Bis zu ${MAX_STRASSEN}, durch Komma getrennt.` },
    { typ: 'text', key: 'start', label: 'Start', wert: (opt().start || {}).eingabe || '', platzhalter: 'Ort oder PLZ', hilfe: ortHilfe(opt().start) },
    { typ: 'text', key: 'ziel', label: 'Ziel', wert: (opt().ziel || {}).eingabe || '', platzhalter: 'Ort oder PLZ', hilfe: ortHilfe(opt().ziel) },
    { typ: 'hinweis', label: 'Start und Ziel bleiben nur in diesem Browser. Gezeigt werden Staus, Sperrungen und Baustellen der Autobahnen nahe der Strecke. Bus und Bahn folgen.' },
    { typ: 'titel', label: 'Tanken' },
    { typ: 'select', key: 'fuel', label: 'Kraftstoff', wert: sorteVon(settings.fuel), optionen: Object.entries(SORTE_NAME).map(([k, v]) => [k, v]) },
    { typ: 'select', key: 'umkreis', label: 'Umkreis', wert: String(umkreis()), optionen: UMKREISE.map(k => [String(k), `${k} km`]) }
  ],
  speichern: async w => {
    const stopNeu = (w.stop || '').trim() || 'Postplatz', umkreisNeu = +w.umkreis !== umkreis();
    const sNeu = strassenVon(w.strassen), strassenText = sNeu ? sNeu.join(', ') : (w.strassen || '').trim();
    const wegNeu = strassenText !== (opt().strassen || '');
    saveSettings({ stop: stopNeu, fuel: sorteVon(w.fuel) });
    kachelOptSpeichern(ID, { ansicht: w.ansicht, umkreis: +w.umkreis, strassen: strassenText });
    if (umkreisNeu) tk = gespeichert('tanken', tankParams()) || null;
    if (wegNeu) aw = strassen().length ? gespeichert('autobahn', wegParams()) || null : null;
    zeichne();
    // Start und Ziel auflösen (nur bei geänderter Eingabe), dann neu zeichnen
    const [start, ziel] = await Promise.all([ortVon(w.start, opt().start), ortVon(w.ziel, opt().ziel)]);
    const vorher = JSON.stringify([opt().start || null, opt().ziel || null]);
    kachelOptSpeichern(ID, { start, ziel });
    zeichne();
    // Start/Ziel neu: Raster zeichnet die übrigen Reiter neu (sonst stünde dort noch der alte Weg) und lädt die Kachel neu
    if (JSON.stringify([start, ziel]) !== vorher) document.dispatchEvent(new CustomEvent('daily:einstellungen', { detail: ID }));
    else load().catch(() => {});
  }
});

export default { id: ID, name: 'Verkehr', every: 60e3, load };
