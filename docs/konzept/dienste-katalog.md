# DAILY – Dienstkatalog (aus der Ideenliste)

Stand 28.09.2026. Quelle der Ideen: `daily-konzept.html`. Jede Idee ist hier einem **Dienst** im Format daily/1 zugeordnet (siehe `../architektur/dienste.md`) oder begründet zurückgestellt.
Welche Dienste später zu welchen Kacheln, Listen oder Oberflächen zusammengefasst werden, entscheiden wir erst, wenn die Dienste laufen.

**Filter (Strategie, `entscheidungen.md` Abschnitt 0):** öffentlich keine Nutzerdaten außer dem Ort, keine Nachrichten.

Legende Art: **Live** = externe Datenquelle · **Rechnen** = ohne Netz berechnet · **Inhalt** = vorbereitete Tagesinhalte (KI-erstellt, geprüft) · **Lokal** = Daten nur im Browser des Nutzers
Status: ✅ fertig in daily/1 · 🔁 läuft, noch alte Schnittstelle · 🆕 neu · ⏸ später · ⛔ ausgeschlossen

## 1. Ort, Wetter, Himmel, Umwelt
| Dienst | Ideen aus der Liste | Art | Eingabe | Quelle (Kandidat) | Status |
|---|---|---|---|---|---|
| `ort` | Standort (Grundlage aller Ortsdienste): Name, Postleitzahl, Gerätestandort | Live | Name, PLZ oder Koordinaten | eigener Bestand aus GeoNames; Ausland Open-Meteo Geocoding | ✅ |
| `wetter` | lokales Wetter (15 Tage), Luftqualität, Pollen | Live | Ort | Open-Meteo (nicht kommerziell) | ✅ |
| `regen` | Regenradar, „Regen in X Minuten“, Regen in der Nähe, Radarkarte (≈ 100 × 100 km, −1 bis +2 Std., seit 0.29.0 mit Landkarte basemap.de) | Live | Ort (Deutschland) | DWD-Radar RV über Bright Sky | ✅ |
| `himmel` | Mondphase, Supermond, Sternschnuppen, Sonnen-/Mondfinsternisse am Ort, Jahreszeiten (Sonnenzeiten stehen im Wetter) – in der Kachel „Kalender“ | Rechnen | Ort | Astronomy Engine (MIT) | ✅ |
| `wetterhinweise` | Warnmeldungen – freundlich als „Wetterhinweise“ mit Alltagstipp, in der Wetterkachel (keine eigene Kachel) | Live | Ort (Deutschland) | amtliche DWD-Warnungen über Bright Sky | ✅ |
| `weltwetter` | Weltwetter (Hauptstädte, Reiseziele) | Live | Liste von Orten | Open-Meteo (mehrere Orte je Abfrage) | 🆕 |
| `klima` | Weltklima, CO₂-Themen | Live | – | NOAA Mauna Loa (CO₂-Tageswert), Copernicus (Temperatur-Abweichung) | 🆕 |
| `wetterkarte` | Wetterkarte, Weltwetterkarte, Weltklimakarte | Live (Kartenbilder) | Ort/Region | DWD-Kartendienst (WMS, GeoNutzV) | ⏸ Darstellung aufwendig |

## 2. Kalender, Zeit, Alltag
| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `feiertage` | Feiertage, Schulferien, Brückentage, Zeitumstellung, Kalenderwoche, Aktions- und Brauchtumstage – Kachel „Kalender“ | Rechnen + Live | Ort (Bundesland aus dem Ort) | eigene Berechnung + OpenHolidays | ✅ |
| `namenstage` | Namenstage – Kachel „Kalender“ | Daten | Datum, Name | feste Liste von DAILY nach dem kirchlichen Kalender | ✅ |
| `an-diesem-tag` | Weltereignisse, historische Ereignisse, Wissenschaftler-Geburtstage | Live | Datum | Wikipedia „An diesem Tag“ (Ereignisse, Geburten) | ✅ 0.35.0 als `andiesemtag` (Ereignisse; Geburten 🆕) |
| `countdowns` | Countdowns, eigene Geburtstage und Jahrestage, Beziehungskalender | Lokal | – | Browser | 🆕 |
| `aufgaben` | Aufgaben, Hausaufgaben, Tagesziele, Wochenziele, On-Track | Lokal | – | Browser | 🔁 (Kachel „Mein Daily“) |
| `notizen` | Notizen, Erinnerungen, Einkaufszettel | Lokal | – | Browser | 🆕 |
| `seiten` | Favoriten, Lieblingsseiten | Lokal | – | Browser | 🔁 (Kachel „Meine Seiten“) |
| `abfall` | Abfallkalender | Live | **Straße/Hausnummer** | je Entsorger unterschiedlich | ⏸ braucht Adresse (mehr als Ort) |
| `veranstaltungen` | lokale Veranstaltungen | Live | Ort | keine freie, bundesweite Quelle bekannt | ⏸ Quelle fehlt |

## 3. Mobilität
| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `abfahrten` | ÖPNV-Abfahrten (Kachel „Verkehr“) | Live | Haltestelle | Verkehrsverbünde über OpenData ÖPNV/DELFI, Start VVO (Entscheidung A, 29.09.2026) | 🔁 |
| `verbindung` | Arbeitsweg Bus/Bahn (Kachel „Verkehr“) | Live | Start und Ziel (nur im Browser gespeichert) | wie `abfahrten` | 🆕 |
| `tanken` | Spritpreise E5/E10/Diesel (Kachel „Verkehr“) | Live | Ort, Umkreis | Tankerkönig (Schlüssel) | ✅ daily/1 (0.27.0) |
| `autobahn` | Arbeitsweg Auto: Staus, Sperrungen, Baustellen je Autobahn (Kachel „Verkehr“) | Live | Autobahnen (z. B. A4, A13) | Autobahn-API des Bundes (autobahn.de) | ✅ daily/1 (0.28.0) |
| `strompreis` | Strompreis (Börsenpreis heute/morgen, für E-Auto und Haushalt) | Live | – | Energy-Charts (Fraunhofer ISE) | 🆕 |
| – | Pendelzeit Auto mit Live-Verkehr | Live | **Start und Ziel** | Routing-Dienste kostenpflichtig (Google, HERE, TomTom) | ⏸ keine freie Quelle |

## 4. Geld

Quellen und Lizenzlage: siehe [Recherche Finanzdaten](../recherche/finanzdaten.md) (Stand 28.09.2026).

| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `finanzen` | Wechselkurse (90 Tage), Leitzinsen, Inflation DE/Euroraum | Live | – (für alle gleich) | EZB (frei, Quelle nennen) | ✅ (0.22.0) |
| `krypto` | Crypto-Kurse öffentlich | Live | Liste von Coins | CoinGecko Demo mit Quellenangabe (öffentlich, nicht kommerziell; ein zentraler Abruf je 5 Min.), mit Einnahmen Bezahl-Plan; privat über `kurse` (Recherche 01.10.2026) | ⏸ |
| `kurse` | DAX, S&P 500, MSCI World, Bitcoin, Ethereum, Gold | Live | – | Yahoo, **nur privat**; öffentlich lizenzierte Quelle nötig (z. B. Vortagesschluss) | ✅ privat (0.22.0) |
| – | Kontenübersicht, Portfolio, Versicherungen, Crypto Assets | – | persönliche Konten | – | ⛔ Nutzerdaten |
| – | Finanz-Tipp, Crypto-Tipp | Inhalt | – | → `tagesinhalt` (nur allgemein, keine Anlageempfehlung) | 🆕 |

## 5. Sport und Freizeit
| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `fussball` | Sport: Verein, Ergebnisse, Tabelle | Live | Liga (Verein sucht der Browser) | OpenLigaDB | ✅ 0.43.0 (je Liga bl1–bl3, ersetzt `api/sport.js`) |
| `raumfahrt` | Raumfahrt: nächste Raketenstarts, ISS-Überflüge | Live | (Ort für Überflüge) | The Space Devs (Launch Library 2) | 🆕 |
| – | TV-Programm, TV-Highlights, Primetime | Live | – | nur lizenzierte Quelle | ⛔ Lizenz |

## 6. Tagesinhalte „des Tages“ (ein Dienst, viele Rubriken)
**Seit 0.34.0:** Dienst `tagesinhalt?datum=<JJJJ-MM-TT>` (daily/1) liefert alle Inhalte eines Tags aus `services/daten/daily.json` – auch vergangene Tage (Verlauf), nie in die Zukunft; Themen-Kacheln Unterhaltung (✅ 0.34.0), Wissen (✅ 0.35.0, mit Dienst `andiesemtag`), Alltag und Spartipp in Finanzen (✅ 0.36.0) mit Blättern, Favoriten, „+ Aufgabe“, Top 11 vorbereitet. Ursprünglicher Plan: Ein Dienst `tagesinhalt?rubrik=<rubrik>&datum=<JJJJ-MM-TT>` liefert alle vorbereiteten Inhalte. Alle Rubriken haben dasselbe Grundgerüst (Titel, Kurztitel, Text, Zusatzfelder je Rubrik), damit Adapter sie einheitlich darstellen können. Heute liegen sie in `services/daten/daily.json`.

| Rubrik | Ideen | Status |
|---|---|---|
| `raetsel`, `witz`, `wortspiel` | Rätsel, Witz, Wortspiel | 🔁 (Rätsel, Witz) / 🆕 |
| `wort`, `buchstabe`, `sprichwort`, `zitat`, `weisheit` | Wort, Buchstabe, Weisheit, Zitat | 🔁 (Wort, Sprichwort) / 🆕 |
| `rezept` | Rezept (schnell, gesund, günstig, vegetarisch, Familie, international) | 🔁 (Varianten 🆕) |
| `land`, `stadt`, `reiseziel`, `sehenswuerdigkeit` | Land, Stadt, Reiseziel, Sehenswürdigkeit, Küche des Landes | 🔁 (Land) / 🆕 |
| `film`, `serie`, `doku` | Film, Serie, Dokumentation, Streaming-Tipp (ohne Programmdaten) | 🔁 (Film) / 🆕 |
| `buch`, `klassiker`, `autor` | Buch, Buchzusammenfassung, Klassiker, Sachbuch, Autor | 🆕 |
| `tech` | Gadget, App, Software, KI-Tool, Erfindung, Technikgeschichte | 🔁 |
| `auto` | Auto des Tages, Elektroautos, Verbrauch, Reichweite | 🆕 |
| `wissenschaft` | wissenschaftliche Entdeckung, historische Person | 🆕 |
| `beziehung` | Beziehungstipp, Date-Idee, Paar-Challenge, kleine Überraschung, Geschenkidee | 🔁 (Tipp) / 🆕 |
| `gesundheit` | Sporttipp, Ernährungstipp | 🔁 |
| `sparen`, `haushalt`, `oeko` | Spartipp (seit 0.31.0 Reiter „Spartipp“ in Finanzen), Haushaltstipp, Öko-Tipp (Energie, Wasser, Müll, nachhaltig einkaufen) | 🔁 (Sparen) / 🆕 |

| Dienst | Ideen | Art | Status |
|---|---|---|---|
| `quiz` | Quiz, Länderquiz, Filmquiz, Musikquiz, Wissenschaftsquiz, Reisequiz | Inhalt (Fragen mit Antworten) | 🆕 |

## 6a. Tools (kein Dienst – eigenständige Seiten)

Kachel „Tools“ (seit App 0.23.0): Werkzeuge als eigene Seiten in `src/tools/`, öffnen im neuen Tab, arbeiten nur im Browser mit Dateien auf dem eigenen Rechner (keine Daten an DAILY oder Dritte, keine Google Fonts). Verzeichnis: `src/js/tools/verzeichnis.js`.

| Tool | Zweck | Datei | Status |
|---|---|---|---|
| Arbeitszeit | Arbeitszeiterfassung mit Gleitzeitkonto, Urlaub/Krank/Feiertag, CSV, Drucken | `src/tools/arbeitszeit.html` | ✅ (0.23.0) |
| Setzkasten | HTML-/Markdown-Editor mit PDF über Druckdialog | `src/tools/setzkasten.html` | ✅ (0.23.0) |

## 7. Später oder ausgeschlossen
| Idee | Entscheidung | Grund |
|---|---|---|
| Nachrichten, Faktencheck, Kritik, Meckerecke, Politik, Abstimmungen, Kommentare, Tech-News | ⛔ öffentlich (Schlagzeilen nur privat) | kein journalistisches Angebot (MStV, AI Act) |
| Mail, Social Media, Benachrichtigungen, Paketstatus | ⛔ | Nutzerdaten, Konten |
| Kalender (iCal) | nur privat – Dienst `termine` (✅ 0.15.0), in der Kachel „Kalender“ | Nutzerdaten |
| Smartwatch, Schritte, Gewicht, Diät-Ticker | ⛔ | Gesundheitsdaten |
| Angebote, Schnäppchen, Preisvergleich, Discounter-Angebote, Leasing, Reiseangebote | ⏸ | keine freie Quelle; später ggf. als gekennzeichnete Partnerangebote |
| Discounter-Rezept aus aktuellen Angeboten | ⏸ | braucht Angebotsdaten |
| KI-Tageszusammenfassung | ⏸ | möglich über die eigenen Dienste (ohne Nachrichten), kostet je Abruf KI-Gebühren |
| Cartooneyesed, Paradeyesed, Morphing-Rätsel/-Video, Bilderrätsel, Daily Schloss, Instagram-Rätsel, Gewinnspiel | ⛔ vorerst | gestrichen bzw. eigenes Produkt (Bilder/Video) |
| Punktesystem / Sehlat-Token | ⛔ vorerst | gestrichen |
| Social-Media-Ausspielung (Content Engine) | ⏸ | eigenes Produkt; kann später dieselben Dienste nutzen |

## Vorschlag Reihenfolge
1. **Umzug** der laufenden Dienste auf daily/1: ~~`himmel`, `feiertage`, `warnungen`, `namenstage`, `termine` (privat)~~ (erledigt, Kacheln „Wetter“ und „Kalender“), offen: `tanken`, `abfahrten`, ~~`fussball`~~ (✅ 0.43.0), ~~`an-diesem-tag`~~ (✅ 0.35.0 `andiesemtag`), ~~`tagesinhalt`~~ (✅ 0.34.0), `kurse` (privat), ~~`schlagzeilen` (privat)~~ (✅ 0.44.0). Roger wählt die Reihenfolge; vor jedem Umzug ein Plan.
2. **Neue Live-Dienste mit freier Quelle:** `waehrungen`, `strompreis`, `verkehr`, `weltwetter`, `raumfahrt`, `krypto`, `klima`.
3. **Neue Tagesinhalte:** weitere Rubriken in `tagesinhalt`, dazu `quiz`.
4. **Lokale Dienste:** `countdowns`, `notizen`.

Alle 🆕-Quellen sind Kandidaten: Nutzungsbedingungen, Verfügbarkeit und Quellenangabe werden bei der Umsetzung geprüft und in `../recht/checkliste.md` festgehalten.
