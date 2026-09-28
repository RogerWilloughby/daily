# DAILY – Dienstkatalog (aus der Ideenliste)

Stand 27.09.2026. Quelle der Ideen: `daily-konzept.html`. Jede Idee ist hier einem **Dienst** im Format daily/1 zugeordnet (siehe `../architektur/dienste.md`) oder begründet zurückgestellt.
Welche Dienste später zu welchen Kacheln, Listen oder Oberflächen zusammengefasst werden, entscheiden wir erst, wenn die Dienste laufen.

**Filter (Strategie, `entscheidungen.md` Abschnitt 0):** öffentlich keine Nutzerdaten außer dem Ort, keine Nachrichten.

Legende Art: **Live** = externe Datenquelle · **Rechnen** = ohne Netz berechnet · **Inhalt** = vorbereitete Tagesinhalte (KI-erstellt, geprüft) · **Lokal** = Daten nur im Browser des Nutzers
Status: ✅ fertig in daily/1 · 🔁 läuft, noch alte Schnittstelle · 🆕 neu · ⏸ später · ⛔ ausgeschlossen

## 1. Ort, Wetter, Himmel, Umwelt
| Dienst | Ideen aus der Liste | Art | Eingabe | Quelle (Kandidat) | Status |
|---|---|---|---|---|---|
| `ort` | Standort (Grundlage aller Ortsdienste): Name, Postleitzahl, Gerätestandort | Live | Name, PLZ oder Koordinaten | eigener Bestand aus GeoNames; Ausland Open-Meteo Geocoding | ✅ |
| `wetter` | lokales Wetter (16 Tage), Luftqualität, Pollen | Live | Ort | Open-Meteo (nicht kommerziell) | ✅ |
| `regen` | Regenradar, „Regen in X Minuten“, Regen in der Nähe, Radarkarte | Live | Ort (Deutschland) | DWD-Radar RV über Bright Sky | ✅ |
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
| `an-diesem-tag` | Weltereignisse, historische Ereignisse, Wissenschaftler-Geburtstage | Live | Datum | Wikipedia „An diesem Tag“ (Ereignisse, Geburten) | 🔁 (Geburten 🆕) |
| `countdowns` | Countdowns, eigene Geburtstage und Jahrestage, Beziehungskalender | Lokal | – | Browser | 🆕 |
| `aufgaben` | Aufgaben, Hausaufgaben, Tagesziele, Wochenziele, On-Track | Lokal | – | Browser | 🔁 (Kachel „Mein Daily“) |
| `notizen` | Notizen, Erinnerungen, Einkaufszettel | Lokal | – | Browser | 🆕 |
| `seiten` | Favoriten, Lieblingsseiten | Lokal | – | Browser | 🔁 (Kachel „Meine Seiten“) |
| `abfall` | Abfallkalender | Live | **Straße/Hausnummer** | je Entsorger unterschiedlich | ⏸ braucht Adresse (mehr als Ort) |
| `veranstaltungen` | lokale Veranstaltungen | Live | Ort | keine freie, bundesweite Quelle bekannt | ⏸ Quelle fehlt |

## 3. Mobilität
| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `abfahrten` | ÖPNV-Abfahrten | Live | Haltestelle | VVO (nur Raum Dresden) | 🔁 |
| `tanken` | Benzinpreise | Live | Ort, Kraftstoff | Tankerkönig (Schlüssel) | 🔁 |
| `verkehr` | Verkehrsinfos, Staus, Baustellen | Live | Ort (Umkreis) | Autobahn-API des Bundes (autobahn.de) | 🆕 |
| `strompreis` | Strompreis (Börsenpreis heute/morgen, für E-Auto und Haushalt) | Live | – | Energy-Charts (Fraunhofer ISE) | 🆕 |
| – | Pendelzeit | Live | **Start und Ziel** | Routing-Dienste meist kostenpflichtig | ⏸ braucht persönliche Adressen |

## 4. Geld
| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `waehrungen` | Währungen | Live | Basiswährung | EZB-Referenzkurse | 🆕 |
| `krypto` | Crypto-Kurse | Live | Liste von Coins | CoinGecko (kostenloser Schlüssel) | 🆕 |
| `kurse` | Börsenindizes, Aktienkurse, Gold | Live | Liste von Werten | Yahoo (nur privat); öffentlich lizenzierte Quelle nötig | 🔁 (privat) |
| – | Kontenübersicht, Portfolio, Versicherungen, Crypto Assets | – | persönliche Konten | – | ⛔ Nutzerdaten |
| – | Finanz-Tipp, Crypto-Tipp | Inhalt | – | → `tagesinhalt` (nur allgemein, keine Anlageempfehlung) | 🆕 |

## 5. Sport und Freizeit
| Dienst | Ideen | Art | Eingabe | Quelle | Status |
|---|---|---|---|---|---|
| `fussball` | Sport: Verein, Ergebnisse, Tabelle | Live | Verein | OpenLigaDB | 🔁 |
| `raumfahrt` | Raumfahrt: nächste Raketenstarts, ISS-Überflüge | Live | (Ort für Überflüge) | The Space Devs (Launch Library 2) | 🆕 |
| – | TV-Programm, TV-Highlights, Primetime | Live | – | nur lizenzierte Quelle | ⛔ Lizenz |

## 6. Tagesinhalte „des Tages“ (ein Dienst, viele Rubriken)
Ein Dienst `tagesinhalt?rubrik=<rubrik>&datum=<JJJJ-MM-TT>` liefert alle vorbereiteten Inhalte. Alle Rubriken haben dasselbe Grundgerüst (Titel, Kurztitel, Text, Zusatzfelder je Rubrik), damit Adapter sie einheitlich darstellen können. Heute liegen sie in `src/content/daily.json`.

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
| `sparen`, `haushalt`, `oeko` | Spartipp, Haushaltstipp, Öko-Tipp (Energie, Wasser, Müll, nachhaltig einkaufen) | 🔁 (Sparen) / 🆕 |

| Dienst | Ideen | Art | Status |
|---|---|---|---|
| `quiz` | Quiz, Länderquiz, Filmquiz, Musikquiz, Wissenschaftsquiz, Reisequiz | Inhalt (Fragen mit Antworten) | 🆕 |

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
1. **Umzug** der laufenden Dienste auf daily/1: ~~`himmel`, `feiertage`, `warnungen`, `namenstage`, `termine` (privat)~~ (erledigt), `tanken`, `abfahrten`, `fussball`, `an-diesem-tag`, `tagesinhalt`, `kurse` (privat).
2. **Neue Live-Dienste mit freier Quelle:** `waehrungen`, `strompreis`, `verkehr`, `weltwetter`, `raumfahrt`, `krypto`, `klima`.
3. **Neue Tagesinhalte:** weitere Rubriken in `tagesinhalt`, dazu `quiz`.
4. **Lokale Dienste:** `countdowns`, `notizen`.

Alle 🆕-Quellen sind Kandidaten: Nutzungsbedingungen, Verfügbarkeit und Quellenangabe werden bei der Umsetzung geprüft und in `../recht/checkliste.md` festgehalten.
