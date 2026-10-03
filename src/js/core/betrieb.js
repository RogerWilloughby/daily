// Betriebsart (öffentlich/privat, aus /api/config) und welche Dienste die Oberfläche abruft.
export const betrieb = { privat: false };   // main.js setzt den Wert einmal beim Start; Anbieter lesen ihn
// Dienste der Oberfläche (seit 0.47.3): nur diese nennt „Woher kommen die Daten?“, nur ihre Antworten bleiben im Browser gespeichert.
// Alle übrigen Dienste laufen nur noch auf dem Server (Entscheidung 02.10.2026: headless, nur pflegen).
export const GENUTZTE_DIENSTE = ['wetter', 'regen', 'wetterhinweise', 'ort', 'feiertage', 'himmel', 'namenstage', 'tagesinhalt', 'andiesemtag', 'dienste'];
