# Dienst `wetter` – Wetter

> Erzeugt aus `services/wetter.js` mit `npm run doku` – nicht von Hand bearbeiten.

Aktuelles Wetter, 48-Stunden- und 16-Tage-Vorhersage (ab Tag 8 als Trend) mit Wind, Sonne, Wolken, Luftdruck, Sicht, Schnee und Frost, dazu Luftqualität und Pollen für einen Ort.

| | |
|---|---|
| Aufruf | `GET /api/v1/wetter` |
| Programmversion | 1.3.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 30 min (z. B. :00/:30) |

## Zweck
Wetter für einen Ort: jetzt, die nächsten 48 Stunden und 16 Tage (ab Tag 8 als Trend gekennzeichnet), mit Wind, Sonne, Wolken, Luftdruck, Sicht, Schnee und Frost, dazu Luftqualität und Pollen.

## Herkunft der Daten
- Open-Meteo Forecast API („best match“): für Deutschland zuerst DWD ICON-D2 (≈ 2 km, ≈ 2 Tage), dann ICON-EU (≈ 7 km, bis 5 Tage) und ICON global (bis 7,5 Tage), danach ECMWF (bis 15 Tage) und GFS (bis 16 Tage).
- Open-Meteo Air Quality API: Luftqualität und Pollen aus Copernicus CAMS (Europa ≈ 11 km).
- Frei nutzbar nur nicht kommerziell (keine Werbung, kein Abo): höchstens 600 Aufrufe/Minute, 5.000/Stunde, 10.000/Tag. Entscheidung 27.09.2026: Open-Meteo, solange DAILY nicht kommerziell ist.

Quellen mit Lizenz:
- Open-Meteo (CC BY 4.0) – https://open-meteo.com
- Open-Meteo Air Quality (Copernicus CAMS) (CC BY 4.0) – https://open-meteo.com/en/docs/air-quality-api

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
- Ort wird über den Dienst „ort“ aufgelöst oder als lat/lon übernommen und auf 2 Nachkommastellen (≈ 1 km) gerundet.
- Open-Meteo wählt die Modellzelle mit ähnlicher Höhe (Höhenmodell 90 m) und rechnet die Temperatur auf die Höhe des Orts um.
- Nur auf Anfrage: Der Server fragt Open-Meteo erst, wenn ein Nutzer diesen Ort anfordert und keine frische Antwort im Cache liegt.
- Takt: Antworten gelten bis zur nächsten vollen oder halben Stunde – alle Nutzer einer 1-km-Zelle teilen sich einen Abruf und sehen denselben Stand.
- WMO-Wettercode → Zustand als Aufzählung (klar, regen, gewitter …); Windrichtung → 8 Himmelsrichtungen; Zeiten als UTC, Tage in der Zeitzone des Orts.
- Abgeleitet: Luftdruck-Tendenz (Änderung jetzt → +3 h, ab 1 hPa steigend/fallend), Frost (Tiefstwert unter 0 °C), Glätte (Tiefstwert ≤ 0,5 °C und Niederschlag oder Neuschnee), Nullgradgrenze (tiefste des Tages), Schneehöhe (höchste des Tages).
- Tage ab dem 8. sind als Trend gekennzeichnet (trend: true) – Oberflächen zeigen sie zurückhaltend.
- Luftqualität optional: fällt sie aus, kommt luft = null und der Hinweis luft_nicht_verfuegbar.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `aktuell` | Wetter jetzt |
| `aktuell.zeit` | Zeitpunkt der Werte (UTC, 15-Minuten-Raster) |
| `aktuell.tempC` | Temperatur in °C |
| `aktuell.gefuehltC` | gefühlte Temperatur in °C |
| `aktuell.code` | WMO-Wettercode |
| `aktuell.zustand` | Zustand als Aufzählung (siehe Schema) |
| `aktuell.tag` | true = Tag, false = Nacht |
| `aktuell.windKmh` | Wind in km/h (10 m Höhe) |
| `aktuell.boeenKmh` | Böen in km/h |
| `aktuell.windRichtungGrad` | Windrichtung in Grad (woher der Wind kommt, 0 = Nord) |
| `aktuell.windRichtung` | Windrichtung: N, NO, O, SO, S, SW, W, NW |
| `aktuell.feuchteProzent` | relative Luftfeuchte in % |
| `aktuell.niederschlagMm` | Niederschlag der letzten Viertelstunde bzw. Stunde in mm |
| `aktuell.wolkenProzent` | Bewölkung in % |
| `aktuell.uvIndex` | UV-Index |
| `aktuell.luftdruckHpa` | Luftdruck auf Meereshöhe in hPa |
| `aktuell.druckAenderung3hHpa` | Änderung des Luftdrucks von jetzt bis in 3 Stunden in hPa |
| `aktuell.druckTendenz` | steigend, gleichbleibend oder fallend (Schwelle 1 hPa in 3 h) |
| `aktuell.sichtweiteM` | Sichtweite in m (unter 1.000 m: Nebel) |
| `aktuell.taupunktC` | Taupunkt in °C (ab etwa 16 °C schwül) |
| `aktuell.schneehoeheCm` | Schneehöhe in cm |
| `stunden` | die nächsten 48 Stunden ab der aktuellen, zeitlich aufsteigend |
| `stunden[].zeit` | Stundenbeginn (UTC) |
| `stunden[].tempC` | Temperatur in °C |
| `stunden[].gefuehltC` | gefühlte Temperatur in °C |
| `stunden[].code` | WMO-Wettercode |
| `stunden[].zustand` | Zustand als Aufzählung |
| `stunden[].regenProzent` | Regenwahrscheinlichkeit in % |
| `stunden[].niederschlagMm` | Niederschlag in mm |
| `stunden[].neuschneeCm` | Neuschnee in cm |
| `stunden[].windKmh` | Wind in km/h |
| `stunden[].boeenKmh` | Böen in km/h |
| `stunden[].windRichtungGrad` | Windrichtung in Grad |
| `stunden[].wolkenProzent` | Bewölkung in % |
| `stunden[].uvIndex` | UV-Index |
| `stunden[].sichtweiteM` | Sichtweite in m |
| `tage` | 16 Tage ab heute, zeitlich aufsteigend |
| `tage[].datum` | Kalendertag JJJJ-MM-TT in der Zeitzone des Orts |
| `tage[].trend` | true ab dem 8. Tag: nur Tendenz, Werte unsicher |
| `tage[].code` | WMO-Wettercode (bedeutendstes Wetter des Tages) |
| `tage[].zustand` | Zustand als Aufzählung |
| `tage[].minC` | Tiefstwert in °C |
| `tage[].maxC` | Höchstwert in °C |
| `tage[].minZeit` | Stunde, in der der Tiefstwert erreicht wird (UTC; aus den Stundenwerten, oder null) |
| `tage[].maxZeit` | Stunde, in der der Höchstwert erreicht wird (UTC; aus den Stundenwerten, oder null) |
| `tage[].regenProzent` | höchste Regenwahrscheinlichkeit des Tages in % |
| `tage[].niederschlagMm` | Niederschlagssumme in mm |
| `tage[].neuschneeCm` | Neuschnee-Summe in cm |
| `tage[].schneehoeheCm` | höchste Schneehöhe des Tages in cm |
| `tage[].nullgradgrenzeM` | tiefste Nullgradgrenze des Tages in m (Schneefallgrenze liegt meist 200–300 m tiefer) |
| `tage[].frost` | true, wenn der Tiefstwert unter 0 °C liegt |
| `tage[].glaette` | true, wenn Tiefstwert ≤ 0,5 °C und Niederschlag oder Neuschnee |
| `tage[].windMaxKmh` | höchste Windgeschwindigkeit in km/h |
| `tage[].boeenMaxKmh` | stärkste Böe in km/h |
| `tage[].windRichtungGrad` | vorherrschende Windrichtung in Grad |
| `tage[].windRichtung` | vorherrschende Windrichtung: N, NO, O, SO, S, SW, W, NW |
| `tage[].sonnenstunden` | Sonnenscheindauer in Stunden |
| `tage[].sonnenaufgang` | Sonnenaufgang (UTC) |
| `tage[].sonnenuntergang` | Sonnenuntergang (UTC) |
| `tage[].uvMax` | höchster UV-Index |
| `luft` | Luftqualität und Pollen jetzt (null, wenn nicht verfügbar) |
| `luft.aqi` | Europäischer Luftqualitätsindex (0 = sehr gut) |
| `luft.stufe` | Stufe: gut, ausreichend, maessig, schlecht, sehr_schlecht, extrem_schlecht |
| `luft.pollen` | Pollenbelastung in Körnern/m³ |
| `luft.pollen.erle` | Erle |
| `luft.pollen.birke` | Birke |
| `luft.pollen.graeser` | Gräser |
| `luft.pollen.beifuss` | Beifuß |
| `luft.pollen.ambrosia` | Ambrosia |

Hinweise (`hinweise`):
- `luft_nicht_verfuegbar`: Luftqualität/Pollen gerade nicht abrufbar, Wetter trotzdem vollständig

## Skalierung
| | |
|---|---|
| Klasse | C – je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar |
| Quelle | Open-Meteo frei: 10.000 Aufrufe/Tag, nur nicht kommerziell. Bezahlt: 29 $/Monat für 1 Mio., 99 $/Monat für 5 Mio. Aufrufe; darüber Enterprise. |
| Kosten | Je Aktualisierung 2 Anfragen an Open-Meteo (Wetter + Luft). Funktion: kurze Laufzeit, fast nur Warten auf die Quelle. |
| Cache | Nur auf Anfrage; CDN und Browser halten die Antwort bis zur nächsten vollen oder halben Stunde. Je belegter 1-km-Zelle höchstens 48 Aktualisierungen/Tag = 96 Abrufe – das freie Kontingent reicht für rund 100 gleichzeitig genutzte Orte. |
| Bei 10 Mio. Aufrufen/Tag | Nicht mit dem freien Open-Meteo: bei z. B. 50.000 belegten Zellen × 48 Aktualisierungen wären es ~4,8 Mio. Abrufe/Tag. Wege: gröberes Raster (z. B. 0,05° ≈ 5 km), bezahlter Tarif (ab 29 $/Monat) oder DWD-Open-Data (MOSMIX: Abrufe unabhängig von der Nutzerzahl). |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.3.0 | 2026-09-28 | Je Tag Uhrzeit des Tiefst- und Höchstwerts (minZeit, maxZeit) aus den Stundenwerten |
| 1.2.0 | 2026-09-27 | 16 Tage (ab Tag 8 Trend), Wind/Sonne/Wolken/Luftdruck/Sicht/Schnee/Frost, Cache-Takt :00/:30 |
| 1.1.0 | 2026-09-27 | Dienstblatt (Herkunft, Verarbeitung, Skalierung) |
| 1.0.0 | 2026-09-27 | Erste Fassung im Format daily/1: jetzt, 48 Stunden, 7 Tage, Luft und Pollen (Open-Meteo) |

