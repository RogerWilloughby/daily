# Dienst `schlagzeilen` – Schlagzeilen (privat)

> Erzeugt aus `services/schlagzeilen.js` mit `npm run doku` – nicht von Hand bearbeiten.

Originalüberschriften von Tagesschau, MDR Sachsen und heise mit Link, neueste zuerst – nur im privaten Betrieb.

| | |
|---|---|
| Aufruf | `GET /api/v1/schlagzeilen` |
| Programmversion | 1.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | privat |
| Länder | weltweit |
| Gültigkeit | 600 s |

## Zweck
Zeigt im privaten Betrieb in der Kachel „Schlagzeilen“ die neuesten Überschriften – gemischt und je Quelle; ein Klick öffnet den Artikel beim Anbieter.

## Herkunft der Daten
- Öffentliche RSS- bzw. Atom-Feeds von Tagesschau, MDR Sachsen und heise – nur Überschrift, Link und Zeit.
- Nur im privaten Betrieb (DAILY_PRIVATE=1) und mit Kennwort: die öffentliche Seite zeigt keine Nachrichten (Strategie 26.09.2026).

Quellen mit Lizenz:
- Tagesschau (RSS/Atom, Originalüberschriften) (ohne Angabe) – https://www.tagesschau.de
- MDR Sachsen (RSS/Atom, Originalüberschriften) (ohne Angabe) – https://www.mdr.de/nachrichten/sachsen
- heise (RSS/Atom, Originalüberschriften) (ohne Angabe) – https://www.heise.de

## Eingabe
| Parameter | Bedeutung |
|---|---|


## Verarbeitung
- Keine Eingaben – eine Antwort für alle (Rogers privater Betrieb).
- Alle Quellen parallel (je 8 s Zeitlimit); je Quelle höchstens 15 Einträge mit Titel und http(s)-Link, Text ohne HTML.
- Gemischt nach Zeit, neueste zuerst, höchstens 30; keine eigene Auswahl, Gewichtung oder Zusammenfassung.
- Fällt eine Quelle aus, kommen die übrigen mit „erreichbar: false“ für diese; ohne jede erreichbare Quelle: quelle_fehler.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `quellen` | die Quellen in fester Reihenfolge |
| `quellen[].id` | Kennung (tagesschau, mdr, heise) |
| `quellen[].name` | Name |
| `quellen[].seite` | Startseite der Quelle |
| `quellen[].erreichbar` | false = Feed gerade nicht erreichbar |
| `quellen[].anzahl` | gelesene Einträge |
| `quellen[].fehler` | was nicht geklappt hat (sonst null) |
| `meldungen` | Überschriften aller Quellen, neueste zuerst (höchstens 30) |
| `meldungen[].quelle` | Kennung der Quelle |
| `meldungen[].titel` | Originalüberschrift |
| `meldungen[].link` | Artikel beim Anbieter |
| `meldungen[].zeit` | Veröffentlichung (UTC), null = unbekannt |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | Öffentliche Feeds der Anbieter, ohne Schlüssel und ohne Zusage. |
| Kosten | Je Abruf 3 Feeds parallel (zusammen typisch 200–800 ms), Lesen < 5 ms. |
| Cache | Keiner im CDN (privat); die Antwort gilt 10 Minuten, der Browser fragt alle 15 Minuten. |
| Bei 10 Mio. Aufrufen/Tag | Nicht öffentlich – nur Rogers privater Betrieb. Öffentlich wären Nachrichten eine neue Strategie-Entscheidung (und bräuchten Nutzungsrechte der Anbieter). |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.0.0 | 2026-10-02 | Umzug aus api/headlines.js in das Format daily/1; je Quelle erreichbar ja/nein; nur privat mit Kennwort |

