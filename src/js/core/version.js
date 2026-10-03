// App-Version der Oberfläche. Die Nummer pflegt Claude bei jeder Änderung (package.json und hier gleich halten, ein Test prüft das):
// kleine Korrektur → 0.6.1, neue Funktion → 0.7.0. Stand (Zeitpunkt) und Commit setzt der Build (build.js) automatisch ein.
export const APP = { version: '0.53.1', stand: null, commit: null };

// Statusleiste (seit 0.51.1): „v0.51.1 · 03.10.2026 09:14“, kurz fürs Handy „v0.51.1 · 3.10. 09:14“ (lokal ohne Stand nur die Nummer)
export function leistenText(app = APP, kurz = false) {
  if (!app.stand) return 'v' + app.version;
  const t = new Date(app.stand), teil = o => t.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', ...o });
  const zeit = teil({ hour: '2-digit', minute: '2-digit' });
  return `v${app.version} · ${kurz ? teil({ day: 'numeric', month: 'numeric' }) : teil({ day: '2-digit', month: '2-digit', year: 'numeric' })} ${zeit}`;
}

// „DAILY 0.6.0 · 27.09.2026 14:32 · b518008“ (lokal ohne Stand und Commit)
export function versionText(app = APP) {
  const stand = app.stand ? new Date(app.stand).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : null;
  return ['DAILY ' + app.version, stand, app.commit].filter(Boolean).join(' · ');
}
