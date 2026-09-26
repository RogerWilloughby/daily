# DAILY – Entscheidungen (Stand 26.09.2026)

Ergebnis der Durchsicht von `daily-konzept.html`, ergänzt um die Nutzungsrecherche (`../recherche/nutzung.md`) und die rechtliche Checkliste (`../recht/checkliste.md`).

## 1. Zielgruppe
Erst für Roger selbst bauen und testen, aber so planen, dass DAILY später öffentlich werden kann.

## 2. Inhaltsquelle „des Tages“
KI-generiert + freie APIs. Fakten (Wetter, Kurse, Sport, Abfahrten, „An diesem Tag“ …) aus APIs; Service-Texte (Rezept, Land, Film, Witz, Rätsel, Wort, Sprichwort, Tipps …) von einer KI vorbereitet.
**Umsetzung jetzt:** `src/content/daily.json` enthält 31 Tage (26.09.–26.10.2026), erzeugt mit `tools/content_2026_10.py`. Nach dem letzten Tag läuft der Vorrat im Kreis weiter (Tag im Jahr), die Seite bleibt also nie leer. Nachschub: Skript um den nächsten Monat erweitern, neu erzeugen, hochladen. Keine eigenen Texte zu aktuellen Ereignissen (siehe 7).

## 3. Raster 5 × 4 – Reihenfolge nach Priorität (Stand der Umsetzung)
Reihe 1 – täglicher Kern:
1. **Wetter [Ort]** – LIVE (Open-Meteo): Wetter, Symbol Tag/Nacht, Regenstunde, Sonne, Luftqualität, Pollen. Ort in der Überschrift.
2. **Kalender** – LIVE (`api/calendar.js`, node-ical, iCal-Links aus den Einstellungen oder `CALENDAR_ICS_URL`). Ohne Link: Kachel „Einrichten“.
3. **Mail** – vorerst ausgesetzt (Kachel „später“, gestrichelt).
4. **Schlagzeilen** – LIVE (`api/headlines.js`: Tagesschau, MDR Sachsen, heise).
5. **Mein Daily** – Aufgaben lokal: hinzufügen, abhaken, löschen.

Reihe 2:
6. **Sport** – LIVE (`api/sport.js`, OpenLigaDB, 1.–3. Liga): Verein aus den Einstellungen (Standard Dynamo Dresden), Platz, letztes/nächstes Spiel, Tabellenausschnitt, Spieltag. Überschrift = Vereinsname.
7. **Geld** – LIVE (`api/markets.js`, Yahoo-Finance-Chartdaten, nur privat): DAX, S&P 500, MSCI World (IWDA), Bitcoin, Ethereum, EUR/USD, Gold. Nur Kurse, keine Empfehlungen.
8. **Rätsel & Witz** – Tagesinhalt, Lösung zum Aufklappen.
9. **Essen** – Rezept des Tages (Zeit, vegetarisch, Zutaten, Zubereitung).
10. **Wissen** – Wort des Tages, Sprichwort, „An diesem Tag“ LIVE aus Wikipedia (`api/onthisday.js`, CC BY-SA 4.0 mit Quellenhinweis und Link).

Reihe 3:
11. **Abfahrten** – LIVE (`api/transit.js`, VVO-Schnittstelle, Echtzeit): Haltestelle aus den Einstellungen (Standard Postplatz), Kennzahl „Tram 1 in 2 min“, Aktualisierung jede Minute.
12. **Gesundheit** – allgemeiner Tagestipp (keine medizinische Beratung); Smartwatch später.
13. **Land des Tages** – Hauptstadt, Sprache, Währung, Gericht, Fakt.
14. **Filmtipp** – Film mit Jahr, Genre, Kurzbeschreibung; keine TV-Programmdaten.
15. **Tech** – Tipp/Tastenkürzel/Technikgeschichte, keine Tech-News.

Reihe 4:
16. **Sparen** – Spartipp (allgemein, keine Finanzberatung) · 17. **Beziehung** – Idee für heute · 18. **Pakete** (später) · freier Platz · 19. **Deine Nutzung** (lokaler Klickzähler mit Zurücksetzen).

Tipp-Kacheln zeigen eine kurze Überschrift als Kennzahl („Deckel auf den Topf“), nicht „Tipp des Tages“. Lange Kennzahlen dürfen zweizeilig umbrechen.

Leiste am unteren Rand (früher Kopfzeile): DAILY, Datum, Uhrzeit, Suchfeld „Frag DAILY“, Links „Impressum“ und „Datenschutz“ (1 Klick, Entwürfe mit Platzhaltern). Antworten von „Frag DAILY“ erscheinen direkt über der Leiste.

Geschätzte Abdeckung der täglichen Info-Abfragen: V1 ≈ 40 %; mit Sport, Mail-Zähler, Suchfeld und Paketstatus ≈ 65–70 %.

## 3a. Einstellungen (Konfigurator)
Zahnrad-Button „Einstellungen“ in der unteren Leiste:
- Ort für das Wetter (Ortssuche über Open-Meteo Geocoding, Auswahl aus Treffern; Standard Dresden)
- Kalender: iCal-Links, einer pro Zeile
- Haltestelle für Abfahrten (Standard Postplatz, VVO-Gebiet)
- Fußballverein (Standard Dynamo Dresden, 1.–3. Liga)
Speicherung nur lokal im Browser (localStorage `daily-settings`), also pro Gerät neu einzutragen. Weitere Einstellungen folgen (z. B. Schlagzeilen-Quellen, Sportverein, Aktien). Späterer Ausbau: Einstellungen geräteübergreifend synchronisieren.

## 3b. Mehrere Nutzer – Stufenplan
- **Stufe 1 (jetzt):** Nutzung ohne Konto. Einstellungen nur lokal im Browser (pro Gerät). Beim ersten Start später: Ort über Browser-Standort oder Ortssuche abfragen. Kalender per iCal-Link (für Fortgeschrittene).
- **Stufe 2:** Optionales Konto („Mit Google anmelden“ oder Anmeldelink per E-Mail) über einen fertigen Anmeldedienst. Einstellungen serverseitig in einer Datenbank, geräteübergreifend synchron. Geheime Werte (iCal-Links, Zugangstoken) verschlüsselt speichern.
- **Stufe 3:** Kalender per Knopfdruck verbinden (Google / Microsoft, nur Lesezugriff über OAuth). Google-Prüfung der App vor öffentlicher Freigabe einplanen (mehrere Wochen). iCal-Link bleibt als Alternative.
- **Voraussetzungen ab Stufe 2 (öffentlich):** ausgefülltes Impressum, vollständige Datenschutzerklärung, Auftragsverarbeitungsverträge mit Anbietern (Hosting, Datenbank, Anmeldedienst), Konto- und Datenlöschung durch den Nutzer, ggf. Datenexport. Vercel Pro statt Hobby, sobald Einnahmen entstehen.
- Die heutige Lösung (Stufe 1) bleibt als Modus ohne Konto erhalten; Stufe 2 und 3 setzen darauf auf, ohne Umbau der App.

## 4. Interaktion Desktop
„Raster wächst mit“: Zeile und Spalte der aktiven Kachel werden breiter (Faktor 4), die anderen schrumpfen, bleiben sichtbar.

## 5. Mobil
Kompaktraster 4 × 5 mit Symbol und Kennzahl, Suchfeld darüber, ohne Scrollen. Tippen öffnet Vollbild, Wischen wechselt.

## 6. Persönliche Anbindungen in Version 1
- Kalender über privaten ICS-Link (nur lesen)
- Aufgaben & Notizen lokal im Browser
Mail, Pakete, Smartwatch, Konten → Stufe 2+.

## 7. Kein journalistisches Angebot
DAILY soll kein journalistisch-redaktionelles Angebot sein (keine Pflichten nach §§ 18 Abs. 2, 19, 20 MStV, keine KI-Kennzeichnung nach AI Act Art. 50 für News). Deshalb gestrichen bzw. geparkt („später, nur mit Redaktion“): Politisches Thema des Tages, Faktencheck, Kritik/Meckerecke/Thema des Tages, Verbesserungsvorschläge an die Politik, von DAILY ausgewählte „wichtigste News“, eigene KI-Zusammenfassungen aktueller Ereignisse, Tech-News-Texte, Klimaereignis-Berichte, Kommentare/Abstimmungen.

## 8. Aktuell gestrichen
Cartooneyesed, Paradeyesed, Sehlat-Token / Punktesystem.

## 9. Messen statt raten
Der Prototyp zählt lokal, welche Kacheln geöffnet werden (Kachel „Deine Nutzung“). Nach ca. zwei Wochen Reihenfolge, V1-Umfang und den freien Platz überprüfen.

## 10. Betrieb
- Progressive Web App (Manifest, Service Worker, Icons), installierbar auf Desktop und Handy.
- Code: privates GitHub-Repo **github.com/RogerWilloughby/daily** (Branch main). Claude kann über den GitHub-Connector hineinschreiben.
- Lokales Repo bei Roger: `C:\Users\Roger\Documents\Projekte\Roger\Craibotics\Daily` (Ordnerfreigabe in der Desktop-App nötig). Alter Ordner Downloads\daily ist überholt.
- **Arbeitsablauf:** Claude schreibt geänderte Dateien in das lokale Repo und dazu eine Datei `.commit-msg.txt` mit dem Commit-Kommentar (1. Zeile Titel, dann Stichpunkte; per .gitignore ausgeschlossen). Roger startet `hochladen.cmd` per Doppelklick: zeigt Claudes Kommentar, Enter übernimmt ihn (`git commit -F`), sonst eigener Text; danach `git push` und Löschen der Kommentardatei. Vercel veröffentlicht automatisch.
- Claude führt im lokalen Repo selbst keine git-Befehle aus (die Desktop-VM kann .git/index.lock nicht zuverlässig entfernen).
- Das Konto Craibotics ist ein separates GitHub-Konto; der Claude-Connector hat dort keinen Zugriff → Repo bewusst unter RogerWilloughby.
- Hosting: Vercel (Hobby), läuft unter der vercel.app-Adresse. Domain daily.craibotics.org (GoDaddy, CNAME „daily“) folgt später.
- Zugriff nur Roger: Vercel Authentication „All Deployments“ aktiv → noch kein ausgefülltes Impressum nötig.
- Schriften selbst gehostet (kein Google Fonts).

## 11. Technischer Aufbau (seit 26.09.2026)
- Frontend ohne Bundler: `src/index.html` (nur Gerüst), `src/app.css` (Design-Tokens, Hell/Dunkel), ES-Module unter `src/js/`:
  - `core/` – `tiles.js` (Kachelliste = Rasterreihenfolge), `board.js` (Raster, Aktivierung, Mobil-Vollbild), `store.js` (Einstellungen, Aufgaben, Klickzähler in localStorage), `ask.js` („Frag DAILY“: jede Datenquelle meldet eigene Antworten an), `status.js` (Statusanzeige), `util.js`.
  - `providers/` – je Datenquelle ein Modul mit `load()` und Intervall (`every`). `main.js` lädt alle, aktualisiert nur bei sichtbarem Tab und meldet Fehler an die Statusanzeige.
  - Neue Kachel = Eintrag in `tiles.js` + Provider-Modul + Eintrag in `main.js`.
- Statusanzeige in der Leiste: „Live · HH:MM“ oder „N Quellen gestört“.
- Server-Funktionen in `api/` (Vercel, Region fra1 = Frankfurt), gemeinsame Helfer in `api/_lib/http.js`. Server-Funktionen verbergen die IP der Nutzer vor den Anbietern und setzen CDN-Cache-Zeiten.
- Service Worker `daily-v2`: App-Dateien network-first, Schriften/Icons cache-first, `/api/` nie aus dem Cache.
- Tests: `npm test` (node:test, ohne Netz) prüft Schlagzeilen, Sport, Abfahrten, Wikipedia-Umwandlung und die Vollständigkeit der 31 Tagesinhalte.
- Lokaler Testserver: `node tools/mock-server.js` (nach `npm run build`), liefert Beispieldaten aus `tools/fixtures.js` statt echter Dienste.

## Design
Grau-grüner Grund, dunkelblaue aktive Kachel, Schriften Bricolage Grotesque + Figtree, Hell- und Dunkelmodus. App-Icon: Raster mit großer „D“-Kachel. Beispieltermin: „Geburtstag von Claude“.
Prototyp: `../prototyp/daily-prototyp.html`.

## Offen
- Domain daily.craibotics.org bei GoDaddy einrichten
- Belegung des letzten freien Platzes (nach Klickzähler entscheiden)
- Datenanbindung: Schlagzeilen, Kalender, Geld, Abfahrten, Sport, Wikipedia, Tagesinhalte (31 Tage) erledigt → Mail und Pakete (Stufe 2, vorerst ausgesetzt)
- Live-Prüfung durch Roger: Abfahrten (VVO) und Sport (OpenLigaDB) wurden nur mit Beispieldaten getestet
- Tagesinhalte ab 27.10.2026 nachlegen (sonst Wiederholung im Kreis)
