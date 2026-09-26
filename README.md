# DAILY

Dein Tag auf einer Seite – persönliche Startseite als Progressive Web App.

- `src/index.html` – die App
- `src/sw.js` – Service Worker (offline-fähige App-Hülle)
- `src/manifest.webmanifest`, `src/icon.svg` – Installation auf Handy und Desktop
- `build.js` – erzeugt `public/` (Vercel führt `npm run build` aus): kopiert die App, holt die Schriften aus npm (Bricolage Grotesque, Figtree; SIL Open Font License, selbst gehostet) und rendert die Icons
- `vercel.json` – Build- und Header-Einstellungen für Vercel

Deployment: Vercel, statisch, kein Framework. Domain: daily.craibotics.org.
Zugriff aktuell nur für den Eigentümer (Vercel Authentication).
