// Zugriff auf die DAILY-Dienste (GET /api/v1/<id>) im Format daily/1.
// Oberflächen holen hierüber Daten und geben sie an einen Adapter (src/js/adapter/) weiter.
const speicher = new Map(); // Anfrage → Antwort, solange sie gültig ist

// Ort aus den Einstellungen → Anfrage-Parameter (Koordinaten auf ~1 km gerundet: Datenschutz und gemeinsamer Cache)
export function ortParams(p) {
  const r = v => Math.round(v * 100) / 100;
  return { lat: r(p.lat), lon: r(p.lon), name: p.name, region: p.admin || p.region, land: p.land, zeitzone: p.zeitzone };
}

export class DienstFehler extends Error {
  constructor(fehler) { super(fehler.meldung || fehler.code); this.code = fehler.code; }
}

export async function dienst(id, params = {}, { frisch = false } = {}) {
  const qs = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const url = `/api/v1/${id}${qs ? '?' + qs : ''}`;
  const alt = speicher.get(url);
  if (!frisch && alt && Date.parse(alt.gueltigBis) > Date.now()) return alt;
  let res, r = null;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
    r = await res.json().catch(() => null);
  } catch (e) {
    throw new DienstFehler({ code: 'nicht_erreichbar', meldung: e.message });
  }
  // Fehlerantworten kommen ebenfalls im Rahmen daily/1 – deren Code weitergeben
  if (r && r.fehler) throw new DienstFehler(r.fehler);
  if (!res.ok || !r || r.format !== 'daily/1') throw new DienstFehler({ code: 'antwort_ungueltig', meldung: 'HTTP ' + res.status });
  speicher.set(url, r);
  return r;
}
