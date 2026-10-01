// Bundesland des gewählten Orts → Kürzel für den Dienst „feiertage“ (bundesland=SN). Der Ort selbst geht nicht an den Dienst:
// eine Antwort je Bundesland statt je Ort (Entscheidung 02.10.2026). Gleiche Liste wie LAENDER in services/feiertage.js (ein Test prüft das).
export const BUNDESLAENDER = {
  'Baden-Württemberg': 'BW', 'Bayern': 'BY', 'Berlin': 'BE', 'Brandenburg': 'BB', 'Bremen': 'HB', 'Hamburg': 'HH',
  'Hessen': 'HE', 'Mecklenburg-Vorpommern': 'MV', 'Niedersachsen': 'NI', 'Nordrhein-Westfalen': 'NW',
  'Rheinland-Pfalz': 'RP', 'Saarland': 'SL', 'Sachsen': 'SN', 'Sachsen-Anhalt': 'ST', 'Schleswig-Holstein': 'SH', 'Thüringen': 'TH'
};
// Ort aus den Einstellungen → Kürzel oder null (Ausland, unbekannt)
export function bundeslandVon(ort) {
  if (!ort || (ort.land && ort.land !== 'DE')) return null;
  return BUNDESLAENDER[ort.admin || ort.region] || null;
}
