// Vertragsversionen, die die Oberfläche je Dienst versteht (Review M6, App 0.46.0).
// Steigt bei einem Dienst die Vertragsversion (services/<id>.js → version, d. h. das Datenformat ändert sich inkompatibel),
// muss die Oberfläche (Adapter) angepasst und die Zahl hier erhöht werden – ein Test prüft, dass beides zusammenpasst.
export const VERTRAG = {
  ort: 1, wetter: 1, regen: 1, wetterhinweise: 1, feiertage: 1, himmel: 1, namenstage: 1, termine: 1,
  finanzen: 1, kurse: 1, tanken: 1, autobahn: 1, tagesinhalt: 1, andiesemtag: 1, fussball: 1, schlagzeilen: 1
};

// null = Antwort passt zur Oberfläche; sonst der Grund (für die Fehlermeldung)
export function vertragFehler(id, r) {
  if (!r || r.format !== 'daily/1') return 'kein daily/1';
  if (r.dienst !== id) return `Antwort von „${r.dienst}“ statt „${id}“`;
  if (!(id in VERTRAG)) return `Dienst „${id}“ ist der Oberfläche unbekannt`;
  if (r.version !== VERTRAG[id]) return `Vertrag ${r.version}, Oberfläche kennt ${VERTRAG[id]}`;
  return null;
}
