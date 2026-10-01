# Dienst `wetterhinweise` – Wetterhinweise

> Erzeugt aus `services/wetterhinweise.js` mit `npm run doku` – nicht von Hand bearbeiten.

Amtliche Wetterwarnungen des Deutschen Wetterdienstes für einen Ort – mit Art, Stufe, Zeitraum, amtlichem Text und einem kurzen Alltagstipp.

| | |
|---|---|
| Aufruf | `GET /api/v1/wetterhinweise` |
| Programmversion | 2.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | DE |
| Gültigkeit | bis zum nächsten Takt von 5 min (z. B. :00/:30) |

## Zweck
Sagt rechtzeitig, worauf man sich einstellen sollte (Glätte, Sturm, Gewitter, Hitze …) – mit einem praktischen Tipp. Erscheint in der Wetterkachel nur, wenn es etwas gibt.

## Herkunft der Daten
- Deutscher Wetterdienst: amtliche Warnungen im CAP-Format für die Warnzelle (Gemeinde) des Orts, Stufen 1 (Wetterwarnung) bis 4 (extremes Unwetter). Open Data nach GeoNutzV mit Quellenvermerk.
- Abgerufen über Bright Sky (freie JSON-Schnittstelle zu DWD-Daten).

Quellen mit Lizenz:
- Deutscher Wetterdienst (amtliche Warnungen) (GeoNutzV (Quellenvermerk)) – https://www.dwd.de/warnungen
- Bright Sky (MIT (Software); Daten DWD) – https://brightsky.dev

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `lat` | Breitengrad, höchstens 2 Nachkommastellen (z. B. 51.05) |
| `lon` | Längengrad, höchstens 2 Nachkommastellen (z. B. 13.74) |

## Verarbeitung
- Testmeldungen und abgelaufene Warnungen werden entfernt; Sortierung: höchste Stufe zuerst, dann nach Beginn.
- Art aus dem amtlichen Ereignis abgeleitet (z. B. „STURMBÖEN“ → wind, „GLATTEIS“ → glaette).
- Amtliche Überschrift, Beschreibung und Handlungsempfehlung bleiben unverändert erhalten.
- Tipp: kurzer Alltagstipp von DAILY je Art; ab Stufe 3 (Unwetter) ein ernster Schutzhinweis. Der Tipp ergänzt die amtliche Warnung, er ersetzt sie nicht.
- Takt 5 Minuten, gemeinsam mit Wetter und Regen im Paket abgerufen.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `gebiet` | Name der Warnzelle (Gemeinde) laut DWD |
| `hoechsteStufe` | höchste Stufe aller Hinweise (0 = keine) |
| `hinweise` | Hinweise, höchste Stufe zuerst |
| `hinweise[].art` | gewitter, wind, regen, schnee, glaette, frost, nebel, hitze, uv, tauwetter, sonstiges |
| `hinweise[].stufe` | 1 Wetterwarnung, 2 markant, 3 Unwetter, 4 extremes Unwetter |
| `hinweise[].stufeName` | wetterwarnung, markant, unwetter, extrem |
| `hinweise[].ereignis` | amtliches Ereignis (z. B. „STURMBÖEN“) |
| `hinweise[].titel` | amtliche Überschrift |
| `hinweise[].beginn` | Beginn (UTC) |
| `hinweise[].ende` | Ende (UTC) |
| `hinweise[].aktiv` | true = gilt schon, false = kommt noch |
| `hinweise[].beschreibung` | amtliche Beschreibung |
| `hinweise[].empfehlung` | amtliche Handlungsempfehlung (kann leer sein) |
| `hinweise[].tipp` | kurzer Alltagstipp von DAILY |

## Skalierung
| | |
|---|---|
| Klasse | C – je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar |
| Quelle | Bright Sky: kostenlos, ohne Schlüssel, keine veröffentlichte Grenze. DWD-Rohdaten (CAP-Dateien) frei. |
| Kosten | Je Aktualisierung 1 kleiner Abruf; Funktion rechnet wenige Millisekunden. |
| Cache | Nur auf Anfrage, gemeinsam im Paket mit Wetter und Regen; CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke. |
| Bei 10 Mio. Aufrufen/Tag | Warnungen gelten je Warnzelle (≈ 11.000 Gemeinden): zentral alle 5 Minuten die DWD-Warnliste laden und je Zelle vorhalten – Abrufe dann unabhängig von der Nutzerzahl. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 2.0.0 | 2026-10-02 | Eingaben nur noch lat/lon mit höchstens 2 Nachkommastellen; Ortssuche per Name (ort=) sowie name, region, land, zeitzone entfallen – die Antwort enthält keinen Ortsnamen mehr (den kennt die Oberfläche). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-09-27 | Erste Fassung: amtliche DWD-Warnungen über Bright Sky, Art, Stufe, Zeitraum und Alltagstipp; ersetzt die Kachel „Warnungen“ |

