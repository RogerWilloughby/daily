# Dienst `fussball` – Fußball

> Erzeugt aus `services/fussball.js` mit `npm run doku` – nicht von Hand bearbeiten.

Tabelle sowie voriger, aktueller und nächster Spieltag der 1., 2. oder 3. Bundesliga (Männer) – mit Ergebnissen und Anstoßzeiten.

| | |
|---|---|
| Aufruf | `GET /api/v1/fussball` |
| Programmversion | 1.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 10 min (z. B. :00/:30) |

## Zweck
Liefert die Kachel „Sport“: Platz, letztes und nächstes Spiel des eigenen Vereins, Tabelle und Spieltag. Den Verein sucht die Oberfläche in der Antwort der Liga.

## Herkunft der Daten
- OpenLigaDB: Tabelle (getbltable) und alle Spiele der Saison (getmatchdata) je Liga – frei, ohne Schlüssel, von einer Community gepflegt.
- Nur Daten (Tabelle, Ergebnisse, Anstoßzeiten), keine Berichte oder Texte.

Quellen mit Lizenz:
- OpenLigaDB (Community-Datenbank für Sportergebnisse) (ohne Angabe) – https://www.openligadb.de

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `liga` | Liga (Pflicht): bl1 = 1. Bundesliga, bl2 = 2. Bundesliga, bl3 = 3. Liga |

## Verarbeitung
- Eingabe nur die Liga (bl1, bl2, bl3) – eine Antwort je Liga für alle Nutzer; andere Angaben werden abgelehnt.
- Saison: ab Juli die neue (September 2026 → 2026/27).
- Aktueller Spieltag: der des frühesten noch nicht beendeten Spiels, sonst der letzte; dazu voriger und nächster Spieltag.
- Tore nur bei beendeten Spielen (Endstand, sonst letzter gemeldeter Stand). Ist OpenLigaDB nicht erreichbar: quelle_fehler.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `liga` | Liga |
| `liga.id` | bl1, bl2 oder bl3 |
| `liga.name` | Name der Liga |
| `saison` | Jahr des Saisonbeginns (2026 = 2026/27) |
| `aktuell` | Nummer des aktuellen Spieltags |
| `tabelle` | Tabelle, Platz 1 zuerst |
| `tabelle[].platz` | Platz |
| `tabelle[].id` | Vereins-Nummer bei OpenLigaDB |
| `tabelle[].name` | Vereinsname |
| `tabelle[].kurz` | Kurzname |
| `tabelle[].spiele` | Spiele |
| `tabelle[].siege` | Siege |
| `tabelle[].unentschieden` | Unentschieden |
| `tabelle[].niederlagen` | Niederlagen |
| `tabelle[].tore` | erzielte Tore |
| `tabelle[].gegentore` | Gegentore |
| `tabelle[].differenz` | Tordifferenz |
| `tabelle[].punkte` | Punkte |
| `spieltage` | voriger, aktueller und nächster Spieltag (soweit vorhanden) |
| `spieltage[].nr` | Nummer |
| `spieltage[].name` | Name (z. B. 9. Spieltag) |
| `spieltage[].spiele` | Spiele, nach Anstoß sortiert |
| `spieltage[].spiele[].heim` | Heimverein |
| `spieltage[].spiele[].heim.id` | Vereins-Nummer |
| `spieltage[].spiele[].heim.name` | Vereinsname |
| `spieltage[].spiele[].heim.kurz` | Kurzname |
| `spieltage[].spiele[].gast` | Gastverein |
| `spieltage[].spiele[].gast.id` | Vereins-Nummer |
| `spieltage[].spiele[].gast.name` | Vereinsname |
| `spieltage[].spiele[].gast.kurz` | Kurzname |
| `spieltage[].spiele[].beginn` | Anstoß (UTC) |
| `spieltage[].spiele[].beendet` | true = Spiel beendet |
| `spieltage[].spiele[].tore` | [Heim, Gast] bei beendeten Spielen, sonst null |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | OpenLigaDB: frei, ohne Schlüssel, ohne veröffentlichte Grenze und ohne Verfügbarkeitszusage. |
| Kosten | Je Liga und 10 Minuten 2 Abrufe (Tabelle, Spiele der Saison ≈ 300 Spiele); Umwandeln < 5 ms. |
| Cache | Für alle gleich je Liga: CDN und Instanz halten die Antwort 10 Minuten – höchstens 3 Fächer. |
| Bei 10 Mio. Aufrufen/Tag | Unkritisch: höchstens 3 Ligen × 2 Abrufe alle 10 Minuten (≈ 860 am Tag), unabhängig von der Nutzerzahl – der Rest sind Cache-Treffer. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.0.0 | 2026-10-02 | Erste Fassung: Tabelle und drei Spieltage je Liga (1.–3. Bundesliga) – eine Antwort je Liga statt je Verein; ersetzt api/sport.js |

