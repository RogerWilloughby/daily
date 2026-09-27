# DAILY – Entscheidungen (Stand 26.09.2026)

Ergebnis der Durchsicht von `daily-konzept.html`, ergänzt um die Nutzungsrecherche (`../recherche/nutzung.md`) und die rechtliche Checkliste (`../recht/checkliste.md`).

## 0. Strategie (Stand 26.09.2026): ohne Nutzerdaten, ohne Nachrichten
DAILY verarbeitet für die öffentliche Version **außer dem Ort keine Nutzerdaten** und zeigt **keine Nachrichten**. Mail, Nachrichten und Kalender holen sich Nutzer bei ihren eigenen Portalen – DAILY verlinkt sie nur („Meine Seiten“).
- **Gestrichen:** Mail, Pakete (brauchen Postfach/Konten).
- **Nur privat** (Vercel-Variable `DAILY_PRIVATE=1`, sonst liefern `api/calendar` und `api/headlines` 404 und die Kacheln fehlen): Kalender (iCal-Link = Nutzerdatum), Schlagzeilen (Nachrichten, Grauzone MStV).
- **Neu, nur mit dem Ort:** Feiertage & Ferien, Warnungen (DWD), Tanken, Himmel; dazu „Meine Seiten“ (nur Links, lokal gespeichert).
- Folgen: kein Konto, keine Datenbank, keine OAuth-Prüfung, kurze Datenschutzerklärung, keine Medienpflichten. Stufen 2 und 3 des Stufenplans (3b) sind damit für die öffentliche Version nicht nötig.
- Nächster Schritt: Dienste aus der Ideenliste umsetzen – Übersicht und Reihenfolge in `dienste-katalog.md`. Danach entscheiden, welche Dienste zu Kacheln/Oberflächen zusammengefasst werden (Technik für eigene Kachelauswahl vorbereitet: `settings.layout`).

## 1. Zielgruppe
Erst für Roger selbst bauen und testen, aber so planen, dass DAILY später öffentlich werden kann.

## 2. Inhaltsquelle „des Tages“
KI-generiert + freie APIs. Fakten (Wetter, Kurse, Sport, Abfahrten, „An diesem Tag“ …) aus APIs; Service-Texte (Rezept, Land, Film, Witz, Rätsel, Wort, Sprichwort, Tipps …) von einer KI vorbereitet.
**Umsetzung jetzt:** `src/content/daily.json` enthält 31 Tage (26.09.–26.10.2026), erzeugt mit `tools/content_2026_10.py`. Nach dem letzten Tag läuft der Vorrat im Kreis weiter (Tag im Jahr), die Seite bleibt also nie leer. Nachschub: Skript um den nächsten Monat erweitern, neu erzeugen, hochladen. Keine eigenen Texte zu aktuellen Ereignissen (siehe 7).

## 3. Raster 5 × 4 – Belegung (Stand der Umsetzung)
**Öffentlich** (Standard), Zeile für Zeile:
1. Wetter [Ort] · Feiertage & Ferien · Meine Seiten · Mein Daily · Abfahrten
2. Sport · Geld · Rätsel & Witz · Essen · Wissen
3. Warnungen · Tanken · Himmel · Land des Tages · Filmtipp
4. Gesundheit · Tech · Sparen · Beziehung · Deine Nutzung

**Privat** (`DAILY_PRIVATE=1`): Reihe 1 = Wetter · Kalender · Schlagzeilen · Mein Daily · Abfahrten; Feiertage und Meine Seiten rücken nach unten, Gesundheit und Beziehung entfallen.

Kacheln und Quellen:
- **Wetter** – LIVE Open-Meteo (Browser): Wetter, Regenstunde, Luft, Pollen. Ort in der Überschrift.
- **Feiertage & Ferien** – gesetzliche Feiertage je Bundesland, Brückentage, Zeitumstellung von DAILY berechnet (`src/js/lib/feiertage.js`, nur landesweite Feiertage); Schulferien über `api/holidays.js` (OpenHolidays API). Bundesland aus der Ortssuche.
- **Meine Seiten** – eigene Links (Mail, Nachrichtenportal, Kalender …), lokal gespeichert, öffnen im neuen Tab. Vorbelegt: Tagesschau, Gmail, Google Kalender.
- **Mein Daily** – Aufgaben lokal.
- **Abfahrten** – LIVE VVO (`api/transit.js`), Haltestelle in den Einstellungen. Nur Raum Dresden; bundesweit bräuchte eine andere Quelle.
- **Sport** – LIVE OpenLigaDB (`api/sport.js`), Verein in den Einstellungen.
- **Geld** – LIVE Yahoo (`api/markets.js`), nur privat zulässig; öffentlich: EZB-Kurse/CoinGecko oder lizenzierte Quelle.
- **Rätsel & Witz, Essen, Land, Filmtipp, Gesundheit, Tech, Sparen, Beziehung** – Tagesinhalte aus `src/content/daily.json`.
- **Wissen** – Wort, Sprichwort, „An diesem Tag“ (Wikipedia, `api/onthisday.js`).
- **Warnungen** – amtliche DWD-Warnungen für den Ort über Bright Sky (`api/alerts.js`), Koordinaten auf ~1 km gerundet.
- **Tanken** – günstigste offene Tankstellen im Umkreis 5 km, Kraftstoff in den Einstellungen (`api/fuel.js`, Tankerkönig CC BY 4.0). Braucht Vercel-Variable `TANKERKOENIG_API_KEY` (kostenlos: onboarding.tankerkoenig.de); ohne Schlüssel zeigt die Kachel „Einrichten“.
- **Himmel** – Tageslänge, Sonne, Mondphase, nächster Voll-/Neumond, Sternschnuppen; ohne Netz berechnet (`src/js/lib/astro.js`).
- **Deine Nutzung** – lokaler Klickzähler.
- Nur privat: **Kalender** (iCal), **Schlagzeilen** (RSS).

## 3a. Einstellungen (Konfigurator)
Zahnrad-Button „Einstellungen“ in der unteren Leiste (der Ort hat seinen eigenen Knopf daneben):
- **Orte (seit 27.09.2026, mehrere):** Auswahlbox in der unteren Leiste mit allen gespeicherten Orten (höchstens 10), dazu „+ Ort hinzufügen …“ und „Orte verwalten …“. Wechsel lädt alle Kacheln für den neuen Ort. Dialog „Orte“: gespeicherte Orte wählen/entfernen, „Meinen Standort ermitteln“ oder Suche mit Vorschlägen – ein Treffer wird aufgenommen und aktiv. Solange kein eigener Ort gespeichert ist, gilt der Beispielort Dresden („Ort wählen …“). Die Dienste bleiben unverändert (Ort kommt mit jeder Anfrage). Ort je Kachel: bewusst noch nicht. Später zu besprechen: „Immer meinen aktuellen Standort verwenden“ (Datenschutz).
- Kalender: iCal-Links, einer pro Zeile (nur im privaten Betrieb sichtbar)
- Haltestelle für Abfahrten (Standard Postplatz, VVO-Gebiet)
- Fußballverein (Standard Dynamo Dresden, 1.–3. Liga)
- Kraftstoff für „Tanken“ (E10, E5, Diesel)
Speicherung nur lokal im Browser (localStorage `daily-settings`), also pro Gerät neu einzutragen. Weitere Einstellungen folgen (z. B. Kachelauswahl, Aktien). Späterer Ausbau: Einstellungen geräteübergreifend synchronisieren.

## 3b. Mehrere Nutzer – Stufenplan (durch Abschnitt 0 überholt: öffentlich bleibt es bei Stufe 1)
- **Stufe 1 (jetzt):** Nutzung ohne Konto. Einstellungen nur lokal im Browser (pro Gerät). Beim ersten Start später: Ort über Browser-Standort oder Ortssuche abfragen. Kalender per iCal-Link (für Fortgeschrittene).
- **Stufe 2:** Optionales Konto („Mit Google anmelden“ oder Anmeldelink per E-Mail) über einen fertigen Anmeldedienst. Einstellungen serverseitig in einer Datenbank, geräteübergreifend synchron. Geheime Werte (iCal-Links, Zugangstoken) verschlüsselt speichern.
- **Stufe 3:** Kalender per Knopfdruck verbinden (Google / Microsoft, nur Lesezugriff über OAuth). Google-Prüfung der App vor öffentlicher Freigabe einplanen (mehrere Wochen). iCal-Link bleibt als Alternative.
- **Voraussetzungen ab Stufe 2 (öffentlich):** ausgefülltes Impressum, vollständige Datenschutzerklärung, Auftragsverarbeitungsverträge mit Anbietern (Hosting, Datenbank, Anmeldedienst), Konto- und Datenlöschung durch den Nutzer, ggf. Datenexport. Vercel Pro statt Hobby, sobald Einnahmen entstehen.
- Die heutige Lösung (Stufe 1) bleibt als Modus ohne Konto erhalten; Stufe 2 und 3 setzen darauf auf, ohne Umbau der App.

## 4. Interaktion Desktop
„Raster wächst mit“: Zeile und Spalte der aktiven Kachel werden breiter (Faktor 4), die anderen schrumpfen, bleiben sichtbar.

## 5. Mobil
Kompaktraster 4 × 5 mit Symbol und Kennzahl, Suchfeld darüber, ohne Scrollen. Tippen öffnet Vollbild, Wischen wechselt.

## 6. Persönliche Anbindungen
- Öffentlich: keine. Aufgaben und Links nur lokal im Browser.
- Privat: Kalender über iCal-Link (nur lesen).
- Mail, Pakete, Smartwatch, Konten: gestrichen (siehe Abschnitt 0).

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
- **Arbeitsablauf (verbindlich, Rogers Vorgabe vom 27.09.2026): immer über `hochladen.cmd`.** Claude schreibt geänderte Dateien in das lokale Repo und dazu eine Datei `.commit-msg.txt` mit dem Commit-Kommentar (1. Zeile Titel, dann Stichpunkte; per .gitignore ausgeschlossen). Roger startet `hochladen.cmd` per Doppelklick: holt zuerst den Stand von GitHub (`git pull --rebase --autostash`), zeigt Claudes Kommentar, Enter übernimmt ihn (`git commit -F`), sonst eigener Text; danach `git push` und Löschen der Kommentardatei. Vercel veröffentlicht automatisch.
- **Nicht** direkt über den GitHub-Connector schreiben (keine Branches, Pull Requests oder push_files): der Connector ist langsam und kostet viele Tokens. Er dient nur zum Lesen.
- Claude führt im lokalen Repo selbst keine git-Befehle aus, auch kein `git status` (jeder Aufruf in der Desktop-VM hinterlässt `.git/index.lock`, die hochladen.cmd blockiert).
- Das Konto Craibotics ist ein separates GitHub-Konto; der Claude-Connector hat dort keinen Zugriff → Repo bewusst unter RogerWilloughby.
- Hosting: Vercel (Hobby), läuft unter der vercel.app-Adresse. Domain daily.craibotics.org (GoDaddy, CNAME „daily“) folgt später.
- Zugriff nur Roger: Vercel Authentication „All Deployments“ aktiv → noch kein ausgefülltes Impressum nötig.
- Schriften selbst gehostet (kein Google Fonts).

## 11. Technischer Aufbau (seit 26.09.2026)
- **Seit 27.09.2026: headless.** Dienste liefern reine Daten im Austauschformat daily/1 über `GET /api/v1/<dienst>`, Adapter machen daraus Kacheln, Listen oder Dashboards. Verbindliche Beschreibung: `../architektur/dienste.md`. Referenz-Dienst: `wetter`.
- **Transparenz:** Jeder Dienst hat ein Dienstblatt (Herkunft, Zweck, Eingabe, Ausgabe, Verarbeitung, Skalierung) – im Code, im Katalog `/api/v1/dienste`, in `docs/dienste/` (`npm run doku`) und in der App unter „Datenquellen“. Skalierungsrahmen: `../architektur/skalierung.md`.
- **Aufgeklappte Kachel (27.09.2026):** oben eine Kopfzeile über die ganze Breite (Überschrift, Wert, Unterzeile, rechts „Schließen“), darunter Reiter und Inhalt über die ganze Breite – statt linker Spalte mit viel Leerraum.
- **Regenradar (27.09.2026):** eigener Dienst `regen` (DWD-Radar RV über Bright Sky, Takt 5 min): Verlauf 2 h, „Regen in X Min.“/„hört auf“, letzte Stunde, Regen in der Nähe (25 km), kleine animierte Karte (2-km-Zellen, alle 15 min). Anzeige in der Wetterkachel: Hinweis im Text und Reiter „Radar“; nur Deutschland und Randgebiete.
- **Versionen (27.09.2026):** App „DAILY 0.6.0 · Datum Uhrzeit · Commit“ (Nummer gepflegt, Rest automatisch beim Build), sichtbar in der Fußzeile, in den Einstellungen und auf der Datenquellen-Seite. Jeder Dienst hat zusätzlich zur Vertragsversion eine Programmversion mit Änderungsliste.
- **Wetterkachel (27.09.2026):** Kopfzeile „Wettersymbol Ort jetzt° · Tiefst°/Höchst°“ (Symbol erklärt sich beim Überfahren; keine große Zeile, kein festes Kachelsymbol), darunter Zustand, gefühlte Temperatur, Regen und das Mini-Diagramm 16 Tage (Höchst/Tiefst, Regenbalken, Trend gestrichelt). Mini-Diagramm beschriftet (höchster/tiefster Wert, Legende). Einheitliche Farben für Zahlen und Linien: Höchst orange, Tiefst blau, Regen grün, Sonne gelb. Aufgeklappt: Reiter „Heute“, „16 Tage“ (drei Felder Temperatur/Niederschlag/Sonne – keine zweite Y-Achse), „48 Stunden“ (Temperatur, Regenwahrscheinlichkeit), „Luft & mehr“ – alles ohne Scrollen; Hinweis je Tag/Stunde beim Überfahren; fehlende Sonnenwerte als „?“ statt 0. Diagramme sind Auswertung im Adapter (`src/js/adapter/diagramm.js`), kein eigener Dienst.
- **Wetter (27.09.2026):** Open-Meteo, solange DAILY nicht kommerziell ist; 16 Tage (ab Tag 8 Trend), Cache bis zur nächsten vollen/halben Stunde; Regen/Radar als eigener Dienst `regen` (DWD). Begründung und Verworfenes: `uebergabe.md`.
- **Eigene Daten, wo es geht:** Orte und Postleitzahlen Deutschland kommen aus dem eigenen Bestand (GeoNames, monatlich per GitHub Action), nicht mehr von OpenPLZ/Nominatim.
- Frontend ohne Bundler: `src/index.html` (nur Gerüst), `src/app.css` (Design-Tokens, Hell/Dunkel), ES-Module unter `src/js/`:
  - `core/` – `tiles.js` (Kachel-Katalog, Layouts öffentlich/privat, `chooseLayout`), `board.js` (Raster, Aktivierung, Mobil-Vollbild), `store.js` (Einstellungen, Aufgaben, Klickzähler in localStorage), `ask.js` („Frag DAILY“: jede Datenquelle meldet eigene Antworten an), `status.js` (Statusanzeige), `util.js`.
  - `providers/` – je Datenquelle ein Modul mit `load()` und Intervall (`every`). `main.js` lädt alle, aktualisiert nur bei sichtbarem Tab und meldet Fehler an die Statusanzeige.
  - Neue Kachel = Eintrag in `tiles.js` + Provider-Modul + Eintrag in `main.js`.
- Statusanzeige in der Leiste: „Live · HH:MM“ oder „N Quellen gestört“.
- Server-Funktionen in `api/` (Vercel, Region fra1 = Frankfurt), gemeinsame Helfer in `api/_lib/http.js`. Server-Funktionen verbergen die IP der Nutzer vor den Anbietern und setzen CDN-Cache-Zeiten.
- Service Worker `daily-<version>-<commit>` (setzt build.js je Upload): App-Dateien network-first, Schriften/Icons cache-first, `/api/` nie aus dem Cache.
- Tests: `npm test` (node:test, ohne Netz, 31 Prüfungen): `test/daily.test.js` (alte Kacheln) und `test/dienste.test.js` (daily/1: Rahmen, Schema, Ort, Wetter, Router, Katalog, Dienstblätter, Adapter).
- Lokaler Testserver: `node tools/mock-server.js` (nach `npm run build`), liefert Beispieldaten aus `tools/fixtures.js` statt echter Dienste; `MOCK_PRIVATE=1` für den privaten Betrieb.
- Betriebsart: `api/config.js` meldet `private` (aus `DAILY_PRIVATE`). `main.js` wählt damit das Layout (`chooseLayout` in `core/tiles.js`) und startet nur die passenden Anbieter. Ein eigenes Layout aus `settings.layout` (Liste von Kachel-IDs) wird geprüft und mit der Standardbelegung auf 20 Plätze aufgefüllt – Grundlage für die Kachelauswahl in den Einstellungen.
- Reine Rechenmodule ohne DOM liegen in `src/js/lib/` (Feiertage, Astronomie, Adressprüfung) und sind so mit `npm test` prüfbar.

## Design
Grau-grüner Grund, dunkelblaue aktive Kachel, Schriften Bricolage Grotesque + Figtree, Hell- und Dunkelmodus. App-Icon: Raster mit großer „D“-Kachel. Beispieltermin: „Geburtstag von Claude“.
Prototyp: `../prototyp/daily-prototyp.html`.

## Offen
- **Roger, einmalig in Vercel (Settings → Environment Variables):** `DAILY_PRIVATE` = `1` (damit Kalender und Schlagzeilen für dich bleiben) und `TANKERKOENIG_API_KEY` (kostenlos beantragen). Danach neu veröffentlichen.
- Aktueller Arbeitsstand und nächste Schritte: `uebergabe.md`
- Wetterdienst überarbeiten (DWD direkt/Bright Sky vs. Open-Meteo, Raster, TTL), danach Vercel vs. AWS bei 10 Mio. Nutzern
- Alle Dienste auf daily/1 umstellen und neue Dienste bauen (Reihenfolge in `dienste-katalog.md`)
- Kachelauswahl in den Einstellungen: weitere Kacheln definieren (Katalog in `core/tiles.js`), Auswahl-Oberfläche bauen
- Geld für die öffentliche Version auf frei nutzbare Quellen umstellen
- Abfahrten bundesweit (andere Datenquelle) oder als Kachel nur für den VVO-Raum kennzeichnen
- Domain daily.craibotics.org bei GoDaddy einrichten
- Live-Prüfung: Warnungen (Bright Sky), Schulferien (OpenHolidays), Tanken (Tankerkönig) wurden nur mit Beispieldaten getestet
- Tagesinhalte ab 27.10.2026 nachlegen
