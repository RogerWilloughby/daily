# Dienst `finanzen` – Finanzen

> Erzeugt aus `services/finanzen.js` mit `npm run doku` – nicht von Hand bearbeiten.

Euro-Wechselkurse der letzten 90 Tage, die Leitzinsen der EZB und die Inflation in Deutschland und im Euroraum – reine Angaben der Europäischen Zentralbank, keine Anlageempfehlung.

| | |
|---|---|
| Aufruf | `GET /api/v1/finanzen` |
| Programmversion | 1.1.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 60 min (z. B. :00/:30) |

## Zweck
Zeigt in der Kachel „Finanzen“, was der Euro wert ist (z. B. 1 € = 1,14 $), wie sich der Kurs entwickelt hat, wie hoch die Leitzinsen sind und wie stark die Preise steigen.

## Herkunft der Daten
- Euro-Referenzkurse der EZB (rund 30 Währungen, werktags gegen 16 Uhr MEZ), Datei der letzten 90 Tage.
- Leitzinsen (Einlagesatz, Hauptrefinanzierungssatz, Spitzenrefinanzierungssatz) aus dem EZB-Datenportal.
- Inflation: Harmonisierter Verbraucherpreisindex (HVPI), Veränderung zum Vorjahresmonat, Deutschland und Euroraum, aus dem EZB-Datenportal.
- Weiterverwendung laut EZB kostenlos, auch kommerziell, mit Quellenangabe und ohne Veränderung der Werte. Die Referenzkurse dienen nur zur Information, nicht für Geschäfte.

Quellen mit Lizenz:
- Europäische Zentralbank (EZB) – Referenzkurse, Leitzinsen, HVPI (frei, Quelle: EZB) – https://www.ecb.europa.eu/stats/

## Eingabe
| Parameter | Bedeutung |
|---|---|


## Verarbeitung
- Keine Eingabe: die Antwort ist für alle Nutzer gleich und wird stündlich erneuert.
- Kurse: je Währung letzter Kurs, Vortag, Veränderung in Prozent (auf 2 Stellen gerundet), 90-Tage-Tief und -Hoch und der Verlauf passend zur Liste „tage“ (null = an diesem Tag kein Kurs). Die Kurse selbst bleiben unverändert.
- Leitzinsen: aktueller Satz mit Datum der letzten Änderung und vorherigem Satz; ist die Reihe der Änderungen nicht erreichbar, nur der aktuelle Satz.
- Ist ein Teil (Leitzinsen oder Inflation) nicht erreichbar, ist er null und ein Hinweis gesetzt; die Kurse kommen trotzdem. Ohne Kurse gibt es einen Fehler.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `stand` | Tag der neuesten Referenzkurse |
| `basis` | Basiswährung (immer EUR: 1 € = kurs) |
| `tage` | Handelstage der letzten 90 Tage, aufsteigend |
| `waehrungen` | Währungen (bekannte zuerst) |
| `waehrungen[].code` | ISO-Code (z. B. USD) |
| `waehrungen[].name` | deutscher Name |
| `waehrungen[].zeichen` | Zeichen (z. B. $) |
| `waehrungen[].kurs` | neuester Kurs: 1 € = kurs |
| `waehrungen[].vortag` | Kurs des Handelstags davor |
| `waehrungen[].aenderungProzent` | Veränderung zum Vortag in % (positiv = Euro stärker) |
| `waehrungen[].tief90` | tiefster Kurs der 90 Tage |
| `waehrungen[].hoch90` | höchster Kurs der 90 Tage |
| `waehrungen[].verlauf` | Kurse passend zu „tage“ (null = kein Kurs) |
| `leitzinsen` | Leitzinsen der EZB (null = nicht erreichbar) |
| `leitzinsen[].art` | einlagen, haupt oder spitzen |
| `leitzinsen[].name` | Name des Satzes |
| `leitzinsen[].satzProzent` | Satz in % pro Jahr |
| `leitzinsen[].seit` | gilt seit (null = unbekannt) |
| `leitzinsen[].vorherProzent` | Satz vor der letzten Änderung |
| `inflation` | Inflationsrate (null = nicht erreichbar) |
| `inflation[].gebiet` | DE (Deutschland) oder U2 (Euroraum) |
| `inflation[].name` | Name des Gebiets |
| `inflation[].monat` | Monat (JJJJ-MM) |
| `inflation[].rateProzent` | Veränderung der Verbraucherpreise zum Vorjahresmonat in % |
| `inflation[].vormonatProzent` | Rate des Monats davor |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | EZB: frei, ohne Schlüssel, keine veröffentlichte Grenze. |
| Kosten | Je Stunde 3 Abrufe (Kursdatei ca. 60 KB, zwei kleine CSV) und Auswertung < 5 ms. |
| Cache | Gültig bis zur nächsten vollen Stunde (Takt 1 Stunde), für alle Nutzer dieselbe Antwort → fast nur Cache-Treffer. |
| Bei 10 Mio. Aufrufen/Tag | Unproblematisch: höchstens 72 Abrufe bei der EZB am Tag, unabhängig von der Nutzerzahl. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.1.0 | 2026-10-02 | Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-09-28 | Erste Fassung: Euro-Referenzkurse (90 Tage), Leitzinsen und Inflation (HVPI) von der EZB |

