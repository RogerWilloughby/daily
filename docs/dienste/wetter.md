# Dienst `wetter` – Wetter

> Erzeugt aus `services/wetter.js` mit `npm run doku` – nicht von Hand bearbeiten.

Aktuelles Wetter, 48-Stunden- und 7-Tage-Vorhersage, Luftqualität und Pollen für einen Ort.

| | |
|---|---|
| Aufruf | `GET /api/v1/wetter` |
| Version | 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit (TTL) | 900 s |

## Zweck
Wetter für einen Ort: jetzt, die nächsten 48 Stunden und 7 Tage, dazu Luftqualität und Pollen. (Stand vor der Überarbeitung – Quelle und Raster werden im nächsten Schritt geprüft.)

## Herkunft der Daten
- Open-Meteo Forecast API: kombiniert Wettermodelle der Wetterdienste; für Deutschland u. a. DWD ICON-D2 (≈ 2 km, 2 Tage), ICON-EU (≈ 7 km, 5 Tage) und ICON global (≈ 11 km).
- Open-Meteo Air Quality API: Luftqualität und Pollen aus Copernicus CAMS (Europa ≈ 11 km).
- Frei nutzbar nur nicht kommerziell: höchstens 600 Aufrufe/Minute, 5.000/Stunde, 10.000/Tag.

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
- Open-Meteo wählt die Modellzelle mit ähnlicher Höhe (Höhenmodell 90 m) und rechnet statistisch auf den Punkt herunter.
- WMO-Wettercode → Zustand als Aufzählung (klar, regen, gewitter …); Zeiten als UTC, Tage in der Zeitzone des Orts.
- Luftqualität optional: fällt sie aus, kommt luft = null und der Hinweis luft_nicht_verfuegbar.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `aktuell` | Wetter jetzt |
| `aktuell.zeit` | Zeitpunkt der Messung/Analyse (UTC) |
| `aktuell.tempC` | Temperatur in °C |
| `aktuell.gefuehltC` | gefühlte Temperatur in °C |
| `aktuell.code` | WMO-Wettercode |
| `aktuell.zustand` | Zustand als Aufzählung (siehe Schema) |
| `aktuell.tag` | true = Tag, false = Nacht |
| `aktuell.windKmh` | Wind in km/h |
| `aktuell.boeenKmh` | Böen in km/h |
| `aktuell.feuchteProzent` | relative Luftfeuchte in % |
| `aktuell.niederschlagMm` | Niederschlag der letzten Stunde in mm |
| `stunden` | die nächsten 48 Stunden ab der aktuellen, zeitlich aufsteigend |
| `stunden[].zeit` | Stundenbeginn (UTC) |
| `stunden[].tempC` | Temperatur in °C |
| `stunden[].code` | WMO-Wettercode |
| `stunden[].zustand` | Zustand als Aufzählung |
| `stunden[].regenProzent` | Regenwahrscheinlichkeit in % |
| `stunden[].niederschlagMm` | Niederschlag in mm |
| `tage` | 7 Tage ab heute, zeitlich aufsteigend |
| `tage[].datum` | Kalendertag JJJJ-MM-TT in der Zeitzone des Orts |
| `tage[].code` | WMO-Wettercode (bedeutendstes Wetter des Tages) |
| `tage[].zustand` | Zustand als Aufzählung |
| `tage[].minC` | Tiefstwert in °C |
| `tage[].maxC` | Höchstwert in °C |
| `tage[].regenProzent` | höchste Regenwahrscheinlichkeit des Tages in % |
| `tage[].niederschlagMm` | Niederschlagssumme in mm |
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
| Kosten | Je Abruf 2 Anfragen an Open-Meteo (Wetter + Luft). Funktion: kurze Laufzeit, fast nur Warten auf die Quelle. |
| Cache | CDN 15 min je gerundetem Ort (≈ 1 km). Alle Nutzer in derselben Zelle teilen sich einen Abruf; der Browser hält die Antwort bis gueltigBis. |
| Bei 10 Mio. Aufrufen/Tag | Nicht mit dem freien Open-Meteo: bei z. B. 50.000 belegten Zellen × 96 Aktualisierungen/Tag wären es ~5 Mio. Quellabrufe/Tag. Wege: gröberes Raster (z. B. 0,05° ≈ 5 km) und längere TTL, bezahlter Tarif oder eigene Daten (DWD-Open-Data ICON/MOSMIX selbst aufbereiten) – wird bei der Überarbeitung des Wetterdienstes entschieden. |

Rahmen und Stufen: `../architektur/skalierung.md`
