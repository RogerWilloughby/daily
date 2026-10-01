// Kachel „Verkehr“: Abfahrten (vorerst /api/transit, VVO – Umzug auf daily/1 folgt), Arbeitsweg Auto (Dienst „autobahn“, daily/1)
// und Tanken (Dienst „tanken“, daily/1). Mini-Reiter in der kleinen Kachel (Abfahrten · Arbeitsweg · Tanken, Zahnrad → Einstellungsfenster), kein Aufklappen.
// Start und Ziel des Arbeitswegs liegen nur in den Einstellungen dieses Browsers; der Dienst „autobahn“ bekommt nur die Autobahnen.
import { set } from '../core/board.js';
import { settings, saveSettings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { dienst, gespeichert, ortParams, mitOrt } from '../dienste/client.js';
import { ansicht as tankAnsicht, antwort as tankAntwort, sorteVon, SORTE_NAME, UMKREISE } from '../adapter/tanken.js';
import { ansicht as wegAnsicht, antwort as wegAntwort, strassenVon, FRAGE as WEG_FRAGE } from '../adapter/autobahn.js';
import { hm, getJson, esc, icon } from '../core/util.js';

const ID = 'verkehr';
export const VERKEHR_STANDARD = { umkreis: 5, strassen: '', start: null, ziel: null };
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
const text = t => `<p class="vk-text">${esc(t)}</p>`;
const kommende = () => (ab && ab.found ? ab.departures.filter(d => Date.parse(d.time) > Date.now() - 60000) : []);

function abfahrtenAnsicht() {
  if (!ab) return { kopf: 'Abfahrten', ms: '–', x: 'Die Abfahrten sind gerade nicht verfügbar.', html: text('Die Abfahrten sind gerade nicht verfügbar.') };
  if (!ab.found) {
    const t = `Haltestelle „${settings.stop}“ wurde nicht gefunden. Im Zahnrad anpassen – vorerst nur Verkehrsverbund Oberelbe (Dresden und Umgebung).`;
    return { kopf: 'Haltestelle wählen', ms: '–', x: t, html: text(t) };
  }
  const deps = kommende(), first = deps[0];
  if (!first) return { kopf: `<b>${esc(ab.stop.name)}</b>`, ms: '–', x: 'Gerade keine Abfahrten.', html: text('In der nächsten Zeit keine Abfahrten.') };
  return {
    kopf: `<b>${esc(ab.stop.name)}</b>`,
    ms: mins(first.time) ? `${mins(first.time)} min` : 'jetzt',
    x: deps.slice(0, 3).map(d => `${lineLabel(d)} → ${d.direction} ${inTxt(d.time)}`).join(' · '),
    // so viele, wie in die Kachel passen (das Raster blendet den Rest aus); Überfahren: Uhrzeit, Verspätung, Steig
    liste: deps.slice(0, 12).map(d => ({ d: inTxt(d.time).replace('in ', ''), t: `${lineLabel(d)} → ${d.direction}${d.delay > 0 ? ` (+${d.delay})` : ''}`,
      tip: `${hm(d.time)}${d.delay > 0 ? ` (+${d.delay} min)` : ''} · ${lineLabel(d)} → ${d.direction}${d.platform ? ' · ' + d.platform : ''}`, gruppe: 1 }))
  };
}

// ---- Tanken (Dienst „tanken“) ----
function tankenAnsicht() {
  if (tkFehler && tkFehler.code === 'schluessel_fehlt' && !tk) {
    const t = 'Für Spritpreise braucht DAILY einen kostenlosen Tankerkönig-Schlüssel (Betreiber, einmalig): onboarding.tankerkoenig.de, dann Vercel-Variable TANKERKOENIG_API_KEY.';
    return { kopf: 'Tanken einrichten', ms: '–', x: t, html: text(t) };
  }
  if (tkFehler && tkFehler.code === 'nicht_unterstuetzt' && !tk) {
    const t = 'Spritpreise gibt es nur für Orte in Deutschland.';
    return { kopf: 'Tanken', ms: '–', x: t, html: text(t) };
  }
  const a = tankAnsicht(mitOrt(tk, settings.place), sorteVon(settings.fuel));
  return a.liste.length ? a : { ...a, html: text(a.x) };
}

// ---- Arbeitsweg Auto (Dienst „autobahn“) ----
function arbeitswegAnsicht() {
  if (!strassen().length) {
    const t = 'Im Zahnrad unter „Arbeitsweg“ die Autobahnen (z. B. A4, A13) sowie Start und Ziel eintragen. Start und Ziel bleiben in diesem Browser.';
    return { kopf: 'Arbeitsweg einrichten', ms: '–', x: t, html: text(t) };
  }
  const a = wegAnsicht(aw, wegOrte());
  return a.liste.length ? a : { ...a, html: text(a.x) };
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

// ---- Kachel zusammensetzen: Mini-Reiter (core/board.js), der gewählte Reiter wird dort je Kachel gespeichert ----
function zeichne() {
  const ab1 = abfahrtenAnsicht(), aw1 = arbeitswegAnsicht(), tk1 = tankenAnsicht();
  const reiter = (id, name, sym, a) => ({ id, name, icon: icon(sym), kopf: a.kopf, liste: a.liste || [], html: a.html || '' });
  set(ID, {
    // am Handy (pausiert) die Kurzform der Abfahrten
    state: ab || tk || aw ? 'live' : 'error', title: 'Verkehr', m: '', ms: ab1.ms, x: ab1.x, liste: [],
    kleinReiter: [reiter('abfahrten', 'Abfahrten', 'tram', ab1), reiter('arbeitsweg', 'Arbeitsweg', 'auto', aw1), reiter('tanken', 'Tanken', 'fuel', tk1)],
    startReiter: opt().ansicht,   // früher gespeicherte Ansicht (bis 0.29.0), bis ein Reiter gewählt wird
    info: ['Abfahrten: VVO (Verkehrsverbund Oberelbe)', ...(aw1.bereich ? ['Arbeitsweg: ' + aw1.bereich] : []),
      'Autobahn: Die Autobahn GmbH des Bundes, teils INRIX', 'Tanken: Tankerkönig (CC BY 4.0), MTS-K' + (tk1.bereich ? ' · ' + tk1.bereich : ''),
      ...(tk && tk.veraltet ? ['Tankpreise Stand ' + hm(tk.erstellt)] : []), ...(aw && aw.veraltet ? ['Autobahn Stand ' + hm(aw.erstellt)] : []), 'Angaben ohne Gewähr']
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

// Frag DAILY
// Autobahn vor Bus/Bahn: „Autobahn“ enthält „bahn“
addAnswer(WEG_FRAGE, q => wegAntwort(q, aw, { ...wegOrte(), strassen: strassen() }));
addAnswer(/tank|benzin|diesel|sprit|super|\be10\b|\be5\b/i, q => tankAntwort(q, mitOrt(tk, settings.place), settings.fuel));
addAnswer(/bus|bahn|tram|straßenbahn|strassenbahn|abfahrt|haltestelle|öpnv|oepnv/i, () => {
  if (!ab || !ab.found) return 'Die Abfahrten sind gerade nicht verfügbar.';
  const deps = kommende().slice(0, 4);
  return deps.length ? `${ab.stop.name}: ` + deps.map(d => `${lineLabel(d)} nach ${d.direction} ${inTxt(d.time)}`).join(', ') + '.' : `${ab.stop.name}: gerade keine Abfahrten.`;
});

// Einstellungen der Kachel (Zahnrad in der Reiterspalte → Einstellungsfenster)
kachelEinstellungen(ID, {
  felder: () => [
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
    kachelOptSpeichern(ID, { umkreis: +w.umkreis, strassen: strassenText });
    if (umkreisNeu) tk = gespeichert('tanken', tankParams()) || null;
    if (wegNeu) aw = strassen().length ? gespeichert('autobahn', wegParams()) || null : null;
    zeichne();
    // Start und Ziel auflösen (nur bei geänderter Eingabe), dann neu zeichnen
    const [start, ziel] = await Promise.all([ortVon(w.start, opt().start), ortVon(w.ziel, opt().ziel)]);
    const vorher = JSON.stringify([opt().start || null, opt().ziel || null]);
    kachelOptSpeichern(ID, { start, ziel });
    zeichne();
    // Start/Ziel neu: Kachel neu laden (das Einstellungsfenster zeigt „Gespeichert ✓“)
    if (JSON.stringify([start, ziel]) !== vorher) document.dispatchEvent(new CustomEvent('daily:einstellungen', { detail: ID }));
    else load().catch(() => {});
  }
});

export default { id: ID, name: 'Verkehr', every: 60e3, load };
