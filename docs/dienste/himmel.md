# Dienst `himmel` – Himmel

> Erzeugt aus `services/himmel.js` mit `npm run doku` – nicht von Hand bearbeiten.

Mond, Mondphasen, Sternschnuppen, Sonnen- und Mondfinsternisse, die am Ort zu sehen sind, und der Beginn der Jahreszeiten.

| | |
|---|---|
| Aufruf | `GET /api/v1/himmel` |
| Programmversion | 2.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 60 min (z. B. :00/:30) |

## Zweck
Sagt, was am Himmel los ist: Vollmond, Supermond, die nächste Sternschnuppen-Nacht, eine Finsternis, die man vom eigenen Ort aus sieht, und wann Frühling, Sommer, Herbst oder Winter beginnen.

## Herkunft der Daten
- Berechnung mit Astronomy Engine (freie Bibliothek, MIT-Lizenz, geprüft gegen NASA JPL Horizons und die NOVAS-Rechnung; Genauigkeit etwa eine Minute).
- Sternschnuppen: Maxima der großen Ströme nach der International Meteor Organization (Mittelwerte, schwanken von Jahr zu Jahr um etwa einen Tag).

Quellen mit Lizenz:
- Astronomy Engine (Berechnung) (MIT) – https://github.com/cosinekitty/astronomy
- Sternschnuppen: Termine der International Meteor Organization (Mittelwerte) (ohne Angabe) – https://www.imo.net

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `lat` | Breitengrad, höchstens 2 Nachkommastellen (z. B. 51.05) |
| `lon` | Längengrad, höchstens 2 Nachkommastellen (z. B. 13.74) |

## Verarbeitung
- Mond: Phase aus dem Winkel zwischen Sonne und Mond; Voll- und Neumond heißen so, solange sie weniger als etwa 20 Stunden entfernt sind.
- Supermond: Vollmond, der näher als 360.000 km an der Erde steht.
- Finsternisse: Suche 5 Jahre voraus; aufgenommen wird nur, was am Ort über dem Horizont steht (ganz oder teilweise). Halbschatten-Mondfinsternisse sind kaum zu sehen und werden weggelassen. Bedeckung: Anteil der Sonnenscheibe bzw. des Monds im Kernschatten.
- Sternschnuppen: die nächsten 3 Maxima mit dem Mondlicht der Nacht – je heller der Mond, desto weniger ist zu sehen.
- Kein Abruf fremder Dienste; Koordinaten auf etwa 1 km gerundet.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `mond` | Mond jetzt |
| `mond.name` | neumond, zunehmende_sichel, erstes_viertel, zunehmender_mond, vollmond, abnehmender_mond, letztes_viertel, abnehmende_sichel |
| `mond.zunehmend` | true = zunehmend |
| `mond.beleuchtung` | beleuchteter Anteil in % |
| `mond.alterTage` | Tage seit Neumond |
| `mond.aufgang` | nächster Mondaufgang (UTC) |
| `mond.untergang` | nächster Monduntergang (UTC) |
| `mond.naechsterVollmond` | nächster Vollmond (UTC) |
| `mond.naechsterNeumond` | nächster Neumond (UTC) |
| `mondphasen` | die nächsten 8 Hauptphasen |
| `mondphasen[].zeit` | Zeitpunkt (UTC) |
| `mondphasen[].phase` | neumond, erstes_viertel, vollmond, letztes_viertel |
| `mondphasen[].entfernungKm` | Entfernung des Vollmonds in km (sonst null) |
| `mondphasen[].supermond` | true = Supermond |
| `sternschnuppen` | die nächsten 3 Sternschnuppen-Maxima |
| `sternschnuppen[].name` | Name des Stroms (z. B. Perseiden) |
| `sternschnuppen[].maximum` | Nacht des Maximums (Abend dieses Tages) |
| `sternschnuppen[].proStunde` | Anzahl je Stunde unter idealen Bedingungen |
| `sternschnuppen[].mondBeleuchtung` | Mondlicht in dieser Nacht in % |
| `finsternisse` | am Ort sichtbare Finsternisse der nächsten 5 Jahre (je Art höchstens 3) |
| `finsternisse[].art` | sonne oder mond |
| `finsternisse[].typ` | partiell, total, ringfoermig |
| `finsternisse[].beginn` | Beginn (UTC) |
| `finsternisse[].maximum` | größte Bedeckung (UTC) |
| `finsternisse[].ende` | Ende (UTC) |
| `finsternisse[].bedeckung` | Bedeckung am Ort in % |
| `finsternisse[].hoeheGrad` | Höhe über dem Horizont beim Maximum (Grad, negativ = unter dem Horizont) |
| `finsternisse[].sichtbar` | ganz oder teilweise (z. B. bei Sonnenaufgang) |
| `jahreszeiten` | Beginn der nächsten 4 Jahreszeiten (astronomisch) |
| `jahreszeiten[].zeit` | Zeitpunkt (UTC) |
| `jahreszeiten[].art` | fruehling, sommer, herbst, winter |

## Skalierung
| | |
|---|---|
| Klasse | A – berechnet – ohne Quelle, beliebig oft |
| Quelle | keine – alles wird gerechnet. |
| Kosten | Etwa 20–40 ms Rechenzeit je Ort und Stunde (Finsternissuche am teuersten). |
| Cache | Takt 1 Stunde; CDN und Browser halten die Antwort bis zur vollen Stunde. |
| Bei 10 Mio. Aufrufen/Tag | Kein Quellenlimit. Rechenzeit ≈ belegte 1-km-Zellen × 24 je Tag; bei Bedarf Finsternisse je 1°-Feld für den Tag vorrechnen. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 2.0.0 | 2026-10-02 | Eingaben nur noch lat/lon mit höchstens 2 Nachkommastellen; Ortssuche per Name (ort=) sowie name, region, land, zeitzone entfallen – die Antwort enthält keinen Ortsnamen mehr (den kennt die Oberfläche). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-09-27 | Erste Fassung als Dienst: Mond, Mondphasen mit Supermond, Sternschnuppen, Finsternisse am Ort, Jahreszeiten – gerechnet mit Astronomy Engine |

