# Dienst `regen` – Regenradar

> Erzeugt aus `services/regen.js` mit `npm run doku` – nicht von Hand bearbeiten.

Regen am Ort jetzt und in den nächsten 2 Stunden (5-Minuten-Schritte), „Regen in X Minuten“, letzte Stunde, Regen in der Nähe und eine Radarkarte (100 × 100 km, −1 bis +2 Stunden).

| | |
|---|---|
| Aufruf | `GET /api/v1/regen` |
| Programmversion | 1.1.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | DE |
| Gültigkeit | bis zum nächsten Takt von 5 min (z. B. :00/:30) |

## Zweck
Beantwortet „Regnet es gleich?“: Regen am Ort jetzt und in den nächsten 2 Stunden, wann er beginnt oder aufhört, was in der letzten Stunde fiel, wo in der Nähe es regnet – dazu eine Radarkarte von 100 × 100 km, die Oberflächen auf eine Landkarte legen können.

## Herkunft der Daten
- Deutscher Wetterdienst, Radar-Komposit RV (RADOLAN/RADVOR): 1-km-Raster über Deutschland und angrenzende Gebiete, alle 5 Minuten, mit Niederschlagsvorhersage bis +2 Stunden. Open Data, Nutzung nach GeoNutzV mit Quellenvermerk – auch kommerziell.
- Abgerufen über Bright Sky (freie JSON-Schnittstelle zu DWD-Daten, Open Source): nur der Ausschnitt von 50 km um den Ort. Bright Sky lässt sich bei Bedarf selbst betreiben.

Quellen mit Lizenz:
- Deutscher Wetterdienst (Radar RV) (GeoNutzV (Quellenvermerk)) – https://opendata.dwd.de/weather/radar/composite/rv/
- Bright Sky (MIT (Software); Daten DWD) – https://brightsky.dev

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `ort` | Ortsname (z. B. Berlin) – oder – |
| `lat` | Breitengrad |
| `lon` | Längengrad |
| `name` | Anzeigename (optional) |
| `region` | Bundesland (optional) |
| `land` | Ländercode (optional) |

## Verarbeitung
- Ort auf 2 Nachkommastellen (≈ 1 km) gerundet; Ausschnitt ±50 km, 1 Stunde zurück bis 2 Stunden voraus.
- Rohwert 0,01 mm je 5 Minuten → mm/h (× 0,12). Stufen: leicht unter 2,5 mm/h, mäßig bis 10, stark bis 50, sehr stark darüber.
- Jetzt = jüngstes gemessenes Bild; Bilder danach sind Vorhersage (gemessen: false). „Beginnt/endet“ = erster Wechsel zwischen Regen und trocken im Verlauf.
- Regen in der Nähe: nächste Zelle mit Regen im Umkreis von 25 km, Richtung vom Ort aus (Rasterwinkel auf geografisch Nord umgerechnet).
- Karte: 2-km-Zellen (stärkste Stufe), ein Bild alle 15 Minuten von −60 Minuten bis +2 Stunden, als Ziffernfolge 0–4 Zeile für Zeile von Nord nach Süd.
- Ecken der Karte als Koordinaten: umgerechnet aus dem Radarraster (polare stereografische Projektion des DWD, Parameter wie bei Bright Sky; geprüft an den Eckpunkten des Rasters). Damit legt die Oberfläche das Radar auf eine Landkarte (Abweichung bei 100 km unter 1 km).
- Takt: Antworten gelten bis zur nächsten 5-Minuten-Marke – alle Nutzer eines 1-km-Felds teilen sich einen Abruf.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `jetzt` | Regen am Ort im jüngsten Radarbild |
| `jetzt.zeit` | Zeitpunkt des Bilds (UTC) |
| `jetzt.mmH` | Regenstärke in mm/h |
| `jetzt.stufe` | kein, leicht, maessig, stark, sehr_stark |
| `regnet` | true, wenn es am Ort gerade regnet |
| `beginnt` | wann der Regen am Ort beginnt (null: trocken für 2 Stunden oder es regnet schon) |
| `beginnt.inMinuten` | Minuten ab jetzt |
| `beginnt.zeit` | Zeitpunkt (UTC) |
| `endet` | wann der Regen am Ort aufhört (null: trocken oder Regen hält 2 Stunden an) |
| `endet.inMinuten` | Minuten ab jetzt |
| `endet.zeit` | Zeitpunkt (UTC) |
| `maxMmH` | stärkster Regen am Ort in den nächsten 2 Stunden in mm/h |
| `verlauf` | jetzt bis +2 Stunden in 5-Minuten-Schritten, zeitlich aufsteigend |
| `verlauf[].zeit` | Zeitpunkt (UTC) |
| `verlauf[].mmH` | Regenstärke in mm/h |
| `verlauf[].stufe` | Stufe |
| `verlauf[].gemessen` | true = Messung, false = Vorhersage |
| `letzteStunde` | Regen am Ort in der letzten Stunde |
| `letzteStunde.summeMm` | gefallene Menge in mm |
| `letzteStunde.aufgehoertVorMinuten` | vor wie vielen Minuten der Regen aufgehört hat (null: nicht geregnet oder regnet noch) |
| `naehe` | nächster Regen im Umkreis von 25 km (null: nirgends) |
| `naehe.entfernungKm` | Entfernung in km (0 = am Ort) |
| `naehe.richtung` | Richtung vom Ort aus: N, NO, O, SO, S, SW, W, NW |
| `naehe.richtungGrad` | Richtung in Grad (0 = Nord) |
| `naehe.stufe` | Stufe dort |
| `karte` | Radarkarte um den Ort, 100 × 100 km (Rasterausrichtung, Norden etwa oben) |
| `karte.zelleKm` | Kantenlänge einer Zelle in km |
| `karte.breite` | Zellen je Zeile |
| `karte.hoehe` | Zeilen |
| `karte.ortX` | Lage des Orts in Zellen von links |
| `karte.ortY` | Lage des Orts in Zellen von oben |
| `karte.ecken` | Ecken der Karte als Koordinaten (äußere Kanten der Zellen) |
| `karte.ecken.nw` | links oben |
| `karte.ecken.nw.lat` | Breitengrad |
| `karte.ecken.nw.lon` | Längengrad |
| `karte.ecken.ne` | rechts oben |
| `karte.ecken.ne.lat` | Breitengrad |
| `karte.ecken.ne.lon` | Längengrad |
| `karte.ecken.sw` | links unten |
| `karte.ecken.sw.lat` | Breitengrad |
| `karte.ecken.sw.lon` | Längengrad |
| `karte.bilder` | ein Bild je 15 Minuten von −60 Minuten bis +2 Stunden (bis jetzt gemessen, danach Vorhersage) |
| `karte.bilder[].zeit` | Zeitpunkt (UTC) |
| `karte.bilder[].gemessen` | true = Messung, false = Vorhersage |
| `karte.bilder[].stufen` | Stufen 0–4 je Zelle als Ziffernfolge, Zeile für Zeile von Nord nach Süd |

## Skalierung
| | |
|---|---|
| Klasse | C – je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar |
| Quelle | Bright Sky: kostenlos, ohne Schlüssel, keine veröffentlichte Grenze, keine zugesicherte Verfügbarkeit. DWD-Rohdaten frei (GeoNutzV). |
| Kosten | Je Aktualisierung 1 Abruf (≈ 103 × 103 Pixel × 37 Bilder, gepackt). Funktion entpackt und rechnet wenige Millisekunden; Antwort ≈ 40 KB (13 Kartenbilder). |
| Cache | Nur auf Anfrage; CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke. Je belegter 1-km-Zelle höchstens 288 Abrufe/Tag. |
| Bei 10 Mio. Aufrufen/Tag | Bright Sky selbst betreiben (Docker, PostgreSQL) oder die RV-Datei des DWD alle 5 Minuten einmal zentral laden und in einem gemeinsamen Speicher vorhalten – dann ist die Zahl der Quellabrufe unabhängig von der Nutzerzahl (288/Tag). |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.1.0 | 2026-09-29 | Karte größer: Ausschnitt ±50 km (vorher ±25), Bilder von −60 min bis +2 Std., Ecken als Koordinaten (karte.ecken) für die Landkarte darunter; Regen in der Nähe bleibt bei 25 km |
| 1.0.0 | 2026-09-27 | Erste Fassung: DWD-Radar über Bright Sky – jetzt, 2 Stunden, letzte Stunde, Regen in der Nähe, kleine Karte |

