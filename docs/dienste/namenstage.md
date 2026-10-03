# Dienst `namenstage` – Namenstage

> Erzeugt aus `services/namenstage.js` mit `npm run doku` – nicht von Hand bearbeiten.

Wer heute und in den nächsten Tagen Namenstag hat – und wann ein bestimmter Vorname Namenstag hat.

| | |
|---|---|
| Aufruf | `GET /api/v1/namenstage` |
| Programmversion | 1.2.1 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 1440 min (z. B. :00/:30) |

## Zweck
Kleiner Anlass zum Gratulieren: zeigt im Kalender, wer heute Namenstag hat, und beantwortet „Wann hat Josef Namenstag?“.

## Herkunft der Daten
- Feste Liste von DAILY (services/daten/namenstage.json): je Tag die üblichen Vornamen nach den Gedenktagen der Heiligen im Allgemeinen Römischen Kalender und im Regionalkalender für das deutsche Sprachgebiet.
- Keine Abrufe und keine Automatik – Namenstage ändern sich praktisch nie; Korrekturen und Ergänzungen direkt in der Datei.

Quellen mit Lizenz:
- DAILY-Auswahl nach dem kirchlichen Kalender (Gedenktage der Heiligen) (ohne Angabe)

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `name` | Vorname (optional, z. B. Josef) – liefert dessen Namenstage |

## Verarbeitung
- Je Tag 1 bis 3 Vornamen in deutscher Schreibweise, der bekannteste zuerst; an Allerheiligen, Allerseelen und einigen Festtagen keine.
- Namenstage folgen der kirchlichen Tradition und unterscheiden sich je Kalender (katholisch, evangelisch, regional) – DAILY zeigt eine Auswahl, keinen amtlichen Kalender.
- „Heute“ in der Zeitzone Europe/Berlin.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `heute` | Namenstage heute |
| `heute.datum` | Tag |
| `heute.namen` | Vornamen |
| `woche` | heute und die nächsten 6 Tage |
| `woche[].datum` | Tag |
| `woche[].namen` | Vornamen |
| `gesucht` | nur mit Eingabe „name“ (sonst null) |
| `gesucht.name` | gesuchter Name |
| `gesucht.tage` | Namenstage als MM-TT |
| `gesucht.naechster` | nächster Namenstag ab heute (oder null) |
| `stand` | Stand der Liste |

## Skalierung
| | |
|---|---|
| Klasse | A – berechnet – ohne Quelle, beliebig oft |
| Quelle | keine – feste Liste (≈ 10 KB) beim Dienst. |
| Kosten | Nachschlagen < 1 ms. |
| Cache | Takt 1 Tag; ohne Namen für alle Nutzer dieselbe Antwort. |
| Bei 10 Mio. Aufrufen/Tag | Unproblematisch: eine Antwort je Tag für alle (CDN), Suchen nach Namen ebenfalls je Tag zwischengespeichert. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.2.1 | 2026-10-03 | Tagestakt endet um Mitternacht deutscher Zeit statt um Mitternacht UTC (1 bzw. 2 Uhr) – auch an Tagen der Zeitumstellung. |
| 1.2.0 | 2026-10-02 | Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.1.0 | 2026-09-27 | Feste, gepflegte Liste deutscher Namenstage nach dem kirchlichen Kalender statt Wikidata-Abruf (lieferte keine brauchbaren deutschen Namen); keine Action mehr |
| 1.0.2 | 2026-09-27 | Deutsche Namen: Vorname aus dem deutschen Namen des Heiligen (nur mit Artikel in der deutschen Wikipedia), Prüfung an bekannten Namenstagen; Bestände ohne Fassung 2 werden ignoriert |
| 1.0.1 | 2026-09-27 | Wikidata-Abruf in kleinen Schritten (die große Abfrage lief in den 60-s-Abbruch); erzeugt über die gemeinsame Action „Daten erneuern“ |
| 1.0.0 | 2026-09-27 | Erste Fassung: Namenstage heute und die nächsten 7 Tage, Suche nach einem Namen; Bestand aus Wikidata (CC0), monatlich erneuert |

