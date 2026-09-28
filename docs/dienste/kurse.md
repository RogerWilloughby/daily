# Dienst `kurse` – Kurse (privat)

> Erzeugt aus `services/kurse.js` mit `npm run doku` – nicht von Hand bearbeiten.

DAX, S&P 500, MSCI World, Bitcoin, Ethereum und Gold als reine Kursangaben mit Veränderung zum Vortag – nur im privaten Betrieb.

| | |
|---|---|
| Aufruf | `GET /api/v1/kurse` |
| Programmversion | 1.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | privat |
| Länder | weltweit |
| Gültigkeit | 300 s |

## Zweck
Zeigt im privaten Betrieb in der Kachel „Finanzen“ (Reiter „Märkte“) die wichtigsten Börsen- und Kryptokurse.

## Herkunft der Daten
- Inoffizielle Chart-Schnittstelle von Yahoo Finance (keine offizielle API). Die Nutzungsbedingungen erlauben nur die persönliche Nutzung; die Kurse stammen von Börsen und Datenanbietern.
- Deshalb nur im privaten Betrieb (DAILY_PRIVATE=1) – öffentlich ist der Dienst gesperrt. Alternativen: docs/recherche/finanzdaten.md.

Quellen mit Lizenz:
- Yahoo Finance (nur private Nutzung) (ohne Angabe) – https://finance.yahoo.com

## Eingabe
| Parameter | Bedeutung |
|---|---|


## Verarbeitung
- Je Wert ein Abruf der Tagesdaten der letzten 5 Tage; Kurs = letzter Kurs, Veränderung zum Schlusskurs des Vortags in % (2 Stellen).
- Fehler je Wert: kurs null und „fehler“ gesetzt; die übrigen Werte kommen trotzdem. Ohne jeden Kurs gibt es einen Fehler.
- Keine Speicherung im CDN (privat); die Antwort gilt 5 Minuten.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `werte` | Kurse in fester Reihenfolge |
| `werte[].id` | Kennung (z. B. dax) |
| `werte[].name` | Name (z. B. DAX) |
| `werte[].einheit` | Pkt (Punkte), EUR oder USD |
| `werte[].kurs` | letzter Kurs (null = nicht verfügbar) |
| `werte[].aenderungProzent` | Veränderung zum Vortag in % |
| `werte[].zeit` | Zeitpunkt des Kurses (UTC) |
| `werte[].fehler` | was nicht geklappt hat (sonst null) |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | Yahoo Finance, inoffiziell, ohne Zusage; nur privat. |
| Kosten | Je Abruf 6 kleine Anfragen, zusammen typisch 300–800 ms. |
| Cache | Keiner im CDN (privat); der Browser fragt alle 15 Minuten. |
| Bei 10 Mio. Aufrufen/Tag | Nicht öffentlich – nur Rogers privater Betrieb. Öffentlich bräuchte es eine lizenzierte Quelle (siehe Recherche). |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.0.0 | 2026-09-28 | Umzug aus api/markets.js in das Format daily/1; nur noch privat |

