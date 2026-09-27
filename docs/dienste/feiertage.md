# Dienst `feiertage` – Feiertage und Ferien

> Erzeugt aus `services/feiertage.js` mit `npm run doku` – nicht von Hand bearbeiten.

Gesetzliche Feiertage und Schulferien des Bundeslands, Brückentage, Zeitumstellung, Kalenderwoche und bekannte Aktionstage – für gut ein Jahr ab heute.

| | |
|---|---|
| Aufruf | `GET /api/v1/feiertage` |
| Programmversion | 1.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | DE |
| Gültigkeit | bis zum nächsten Takt von 1440 min (z. B. :00/:30) |

## Zweck
Zeigt, wann frei ist und was ansteht: nächster Feiertag, laufende oder nächste Ferien, Brückentage, Zeitumstellung, Muttertag, Advent …

## Herkunft der Daten
- Gesetzliche Feiertage: von DAILY aus den Feiertagsgesetzen der Länder berechnet (Ostertermin nach Gauß). Nur landesweite Feiertage; örtliche (z. B. Fronleichnam in Teilen Sachsens und Thüringens, Augsburger Friedensfest, Mariä Himmelfahrt in Teilen Bayerns) sind nicht enthalten.
- Schulferien: OpenHolidays API (freie Datenbank der Ferien- und Feiertage in Europa) für das Bundesland.
- Aktions- und Brauchtumstage: feste Liste von DAILY (Muttertag, Erntedank, Advent, Welttage …), Termine berechnet.

Quellen mit Lizenz:
- DAILY (Berechnung: Feiertage, Brückentage, Zeitumstellung, Aktionstage) (ohne Angabe)
- OpenHolidays API (Schulferien) (Open Data (frei nutzbar, Quellenangabe)) – https://www.openholidaysapi.org

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `ort` | Ortsname (z. B. Dresden) – oder – |
| `lat` | Breitengrad |
| `lon` | Längengrad |
| `region` | Bundesland (optional, sonst aus dem Ort) |
| `land` | Ländercode (optional) |

## Verarbeitung
- Bundesland aus der Eingabe „region“ oder, wenn sie fehlt, über den nächsten Ort im eigenen Ortsbestand.
- Zeitraum: heute bis 400 Tage voraus; „heute“ in der Zeitzone Europe/Berlin.
- Brückentag: Feiertag am Dienstag → Montag davor, am Donnerstag → Freitag danach.
- Aktionstage, die im Land ohnehin Feiertag sind (z. B. Frauentag in Berlin), erscheinen nur als Feiertag.
- Sind die Schulferien nicht erreichbar, ist „ferien“ null und der Hinweis „ferien_nicht_erreichbar“ gesetzt; alles Berechnete kommt trotzdem.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `bundesland` | Bundesland (z. B. Sachsen) |
| `kuerzel` | Kürzel des Bundeslands (z. B. SN) |
| `heute` | heutiger Tag (Europe/Berlin) |
| `kalenderwoche` | ISO-Kalenderwoche von heute |
| `feiertage` | gesetzliche Feiertage ab heute |
| `feiertage[].datum` | Tag |
| `feiertage[].name` | Name des Feiertags |
| `feiertage[].bundesweit` | true = in ganz Deutschland |
| `feiertage[].wochentag` | 0 = Sonntag … 6 = Samstag |
| `feiertage[].brueckentag` | passender Brückentag oder null |
| `ferien` | Schulferien, die noch nicht vorbei sind (null = Quelle nicht erreichbar) |
| `ferien[].name` | Name (z. B. Herbstferien) |
| `ferien[].von` | erster Ferientag |
| `ferien[].bis` | letzter Ferientag |
| `zeitumstellung` | nächste Zeitumstellungen |
| `zeitumstellung[].datum` | Tag (Sonntag, 2 bzw. 3 Uhr) |
| `zeitumstellung[].art` | sommerzeit (Uhr vor) oder winterzeit (Uhr zurück) |
| `aktionstage` | Aktions-, Brauchtums- und Gedenktage ab heute |
| `aktionstage[].datum` | Tag |
| `aktionstage[].name` | Name (z. B. Muttertag) |
| `aktionstage[].art` | brauch, welttag oder gedenktag |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | OpenHolidays: frei, ohne Schlüssel, keine veröffentlichte Grenze. Alles andere wird gerechnet. |
| Kosten | Je Bundesland und Tag 1 Abruf der Ferien; Rechnen < 1 ms. |
| Cache | Gültig bis Mitternacht (UTC, Takt 1 Tag); nur 16 Bundesländer → fast nur Cache-Treffer. |
| Bei 10 Mio. Aufrufen/Tag | Unproblematisch: höchstens 16 Ferien-Abrufe am Tag, unabhängig von der Nutzerzahl. Später Ferien einmal im Monat per GitHub Action ablegen. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.0.0 | 2026-09-27 | Erste Fassung als Dienst: Feiertage je Bundesland, Schulferien (OpenHolidays), Brückentage, Zeitumstellung, Kalenderwoche, Aktions- und Brauchtumstage; Bundesland aus dem Ort |

