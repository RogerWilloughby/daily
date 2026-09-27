# Dienst `namenstage` – Namenstage

> Erzeugt aus `services/namenstage.js` mit `npm run doku` – nicht von Hand bearbeiten.

Wer heute und in den nächsten Tagen Namenstag hat – und wann ein bestimmter Vorname Namenstag hat.

| | |
|---|---|
| Aufruf | `GET /api/v1/namenstage` |
| Programmversion | 1.0.2 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 1440 min (z. B. :00/:30) |

## Zweck
Kleiner Anlass zum Gratulieren: zeigt im Kalender, wer heute Namenstag hat, und beantwortet „Wann hat Josef Namenstag?“.

## Herkunft der Daten
- Wikidata (freie Wissensdatenbank, CC0): Personen mit Gedenktag (Eigenschaft „Gedenktag“), die einen Artikel in der deutschen Wikipedia haben. Der Vorname kommt aus ihrem deutschen Namen („Josef von Nazaret“ → Josef).
- Eigener Bestand services/daten/namenstage.json, erzeugt monatlich per GitHub Action „Daten erneuern“ (Erzeuger tools/daten/namenstage.js → tools/namenstage-daten.js).

Quellen mit Lizenz:
- Wikidata (Gedenktage der Heiligen, Namenstage) (CC0 1.0 (gemeinfrei)) – https://www.wikidata.org

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `name` | Vorname (optional, z. B. Josef) – liefert dessen Namenstage |

## Verarbeitung
- Je Tag höchstens 6 Vornamen, bekannteste Heilige zuerst (Zahl der Wikipedia-Sprachversionen).
- Nur echte Vornamen (ein Wort, auch mit Bindestrich); deutsche Schreibweise aus Wikidata.
- Namenstage folgen der kirchlichen Tradition und unterscheiden sich je Kalender (katholisch, evangelisch, regional) – DAILY zeigt eine Auswahl, keinen amtlichen Kalender.
- Eine Erzeugung wird verworfen (alter Stand bleibt), wenn weniger als 300 Tage oder 300 Namen herauskommen oder mehr als 2 von 8 bekannten Namenstagen fehlen (Josef 19.3., Johannes 24.6., Martin 11.11., Nikolaus 6.12., Georg 23.4., Elisabeth 19.11., Barbara 4.12., Franz 4.10.).
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
| `stand` | Tag der letzten Erneuerung aus Wikidata (null = noch nicht erzeugt) |

## Skalierung
| | |
|---|---|
| Klasse | A – berechnet – ohne Quelle, beliebig oft |
| Quelle | keine zur Laufzeit – eigener Bestand (≈ 20 KB), Wikidata nur einmal im Monat per Action. |
| Kosten | Nachschlagen < 1 ms. |
| Cache | Takt 1 Tag; ohne Namen für alle Nutzer dieselbe Antwort. |
| Bei 10 Mio. Aufrufen/Tag | Unproblematisch: eine Antwort je Tag für alle (CDN), Suchen nach Namen ebenfalls je Tag zwischengespeichert. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.0.2 | 2026-09-27 | Deutsche Namen: Vorname aus dem deutschen Namen des Heiligen (nur mit Artikel in der deutschen Wikipedia), Prüfung an bekannten Namenstagen; Bestände ohne Fassung 2 werden ignoriert |
| 1.0.1 | 2026-09-27 | Wikidata-Abruf in kleinen Schritten (die große Abfrage lief in den 60-s-Abbruch); erzeugt über die gemeinsame Action „Daten erneuern“ |
| 1.0.0 | 2026-09-27 | Erste Fassung: Namenstage heute und die nächsten 7 Tage, Suche nach einem Namen; Bestand aus Wikidata (CC0), monatlich erneuert |

