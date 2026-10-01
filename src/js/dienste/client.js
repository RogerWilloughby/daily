// Zugriff auf die DAILY-Dienste (GET /api/v1/<id>) im Format daily/1.
// Oberflächen holen hierüber Daten und geben sie an einen Adapter (src/js/adapter/) weiter.
const speicher = new Map(); // Anfrage → Antwort, solange sie gültig ist

// Ort aus den Einstellungen → Anfrage-Parameter: NUR die Koordinaten, auf ~1 km gerundet (Datenschutz und gemeinsamer Cache).
// Name, Bundesland, Land, Zeitzone kennt der Browser selbst – in der Adresse würden sie den Cache je Schreibweise zersplittern (02.10.2026).
export function ortParams(p) {
  const r = v => Math.round(v * 100) / 100;
  return { lat: r(p.lat), lon: r(p.lon) };
}

// Ortsdienste liefern seit 0.40.0 keinen Ortsnamen mehr (die Adresse enthält nur die Koordinaten): Name, Region und Land
// des gewählten Orts setzt die Oberfläche hier ein – angezeigt wird so immer genau der gewählte Ort, auch im Ausland.
export const mitOrt = (env, ort) => (env && env.ort && ort
  ? { ...env, ort: { ...env.ort, name: ort.name || null, region: ort.admin || ort.region || null, land: ort.land || 'DE', zeitzone: env.ort.zeitzone || ort.zeitzone || null } }
  : env);

export class DienstFehler extends Error {
  constructor(fehler) { super(fehler.meldung || fehler.code); this.code = fehler.code; }
}

// ---- Dauerhafter Speicher im Browser: letzte gute Antwort je Anfrage ----
// Damit zeigt DAILY beim Öffnen sofort den letzten Stand und bleibt benutzbar, wenn eine Quelle ausfällt oder langsam ist.
const DKEY = 'daily-dienst:', DMAX = 30;
function merke(url, r) {
  try {
    localStorage.setItem(DKEY + url, JSON.stringify(r));
    const alle = Object.keys(localStorage).filter(k => k.startsWith(DKEY));
    if (alle.length > DMAX) alle.map(k => [k, (JSON.parse(localStorage.getItem(k)) || {}).erstellt || ''])
      .sort((x, y) => (x[1] < y[1] ? -1 : 1)).slice(0, alle.length - DMAX).forEach(([k]) => localStorage.removeItem(k));
  } catch (e) { /* Speicher voll oder gesperrt: dann eben ohne */ }
}
function erinnere(url) {
  try { const r = JSON.parse(localStorage.getItem(DKEY + url)); return r && r.format === 'daily/1' ? r : null; } catch (e) { return null; }
}
const urlVon = (id, params) => {
  const qs = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `/api/v1/${id}${qs ? '?' + qs : ''}`;
};
// Letzter gespeicherter Stand (auch abgelaufen) – zum sofortigen Anzeigen beim Öffnen
export const gespeichert = (id, params = {}) => speicher.get(urlVon(id, params)) || erinnere(urlVon(id, params));
// Bei diesen Fehlern lieber den letzten Stand zeigen als eine leere Kachel
const RUECKFALL = new Set(['nicht_erreichbar', 'quelle_fehler', 'intern', 'antwort_ungueltig']);
const alsVeraltet = r => Object.assign(Object.create(Object.getPrototypeOf(r)), r, { veraltet: true });

// ---- Messung: Ladezeit je Anfrage (für die Statusanzeige) ----
const hoerer = [];
export const aufMessung = fn => hoerer.push(fn);
const melde = (name, ms, quelle) => hoerer.forEach(fn => { try { fn(name, Math.round(ms), quelle); } catch (e) { /* egal */ } });
const uhr = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

async function hole(url) {
  let res, r = null;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
    r = await res.json().catch(() => null);
  } catch (e) {
    throw new DienstFehler({ code: 'nicht_erreichbar', meldung: e.message });
  }
  if (r && r.fehler) throw new DienstFehler(r.fehler);
  if (!res.ok || !r || r.format !== 'daily/1') throw new DienstFehler({ code: 'antwort_ungueltig', meldung: 'HTTP ' + res.status });
  return r;
}

export async function dienst(id, params = {}, { frisch = false } = {}) {
  const url = urlVon(id, params);
  const alt = speicher.get(url);
  if (!frisch && alt && Date.parse(alt.gueltigBis) > Date.now()) { melde(id, 0, 'speicher'); return alt; }
  const t0 = uhr();
  try {
    const r = await hole(url);
    speicher.set(url, r); merke(url, r); melde(id, uhr() - t0, 'netz');
    return r;
  } catch (e) {
    const letzt = alt || erinnere(url);
    if (letzt && RUECKFALL.has(e.code)) { melde(id, uhr() - t0, 'rueckfall'); return alsVeraltet(letzt); }
    throw e;
  }
}

// Privater Dienst per POST (z. B. „termine“ mit den Kalender-Links im Körper): nie zwischengespeichert, nie im Browser-Speicher
export async function privatDienst(id, koerper = {}) {
  const t0 = uhr();
  let res, r = null;
  try {
    res = await fetch(`/api/v1/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(koerper),
      cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
    r = await res.json().catch(() => null);
  } catch (e) { throw new DienstFehler({ code: 'nicht_erreichbar', meldung: e.message }); }
  if (r && r.fehler) throw new DienstFehler(r.fehler);
  if (!res.ok || !r || r.format !== 'daily/1') throw new DienstFehler({ code: 'antwort_ungueltig', meldung: 'HTTP ' + res.status });
  melde(id, uhr() - t0, 'netz');
  return r;
}

