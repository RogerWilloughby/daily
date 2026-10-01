// App-Version der Oberfläche. Die Nummer pflegt Claude bei jeder Änderung (package.json und hier gleich halten, ein Test prüft das):
// kleine Korrektur → 0.6.1, neue Funktion → 0.7.0. Stand (Zeitpunkt) und Commit setzt der Build (build.js) automatisch ein.
export const APP = { version: '0.38.0', stand: null, commit: null };

// „DAILY 0.6.0 · 27.09.2026 14:32 · b518008“ (lokal ohne Stand und Commit)
export function versionText(app = APP) {
  const stand = app.stand ? new Date(app.stand).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : null;
  return ['DAILY ' + app.version, stand, app.commit].filter(Boolean).join(' · ');
}
