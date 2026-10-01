# Dienst `ort` – Standort

> Erzeugt aus `services/ort.js` mit `npm run doku` – nicht von Hand bearbeiten.

Findet Orte nach Name, Postleitzahl oder Koordinaten – mit Landkreis, Bundesland, Postleitzahlen und Zeitzone. Deutschland aus eigenem Bestand, Ausland nach Name.

| | |
|---|---|
| Aufruf | `GET /api/v1/ort` |
| Programmversion | 1.4.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | 86400 s |

## Zweck
Grundlage aller ortsbezogenen Dienste: macht aus einer Eingabe des Nutzers (Name, Postleitzahl oder Gerätestandort) einen eindeutigen Ort mit Koordinaten.

## Herkunft der Daten
- Deutschland: eigener Ortsbestand aus den GeoNames-Postleitzahldaten, Einwohnerzahlen aus dem GeoNames-Ortsverzeichnis (beide CC BY 4.0). Feste Datei; bei Bedarf einmalig neu erzeugt mit tools/orte-daten.js (Orte ändern sich kaum). Liegt als Datei beim Dienst – keine externe Anfrage.
- Ausland: Open-Meteo Geocoding (Datenbasis GeoNames), nur Namenssuche und nur, wenn kein deutscher Ort genau passt oder der beste deutsche Treffer weniger als 5.000 Einwohner hat.

Quellen mit Lizenz:
- GeoNames Postal Codes (eigener Ortsbestand) (CC BY 4.0) – https://www.geonames.org
- Open-Meteo Geocoding (GeoNames) (CC BY 4.0) – https://open-meteo.com/en/docs/geocoding-api

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `q` | Ortsname oder Postleitzahl (mind. 2 Zeichen) – oder – |
| `lat` | Breitengrad (Umkehrsuche, nur Deutschland) |
| `lon` | Längengrad (Umkehrsuche, nur Deutschland) |
| `land` | optional „DE“: nur Deutschland (für Vorschläge beim Tippen, ohne Auslandsabruf) |

## Verarbeitung
- Großkunden-Postleitzahlen (Firmen, Behörden, Kassen) werden beim Erzeugen herausgefiltert.
- Bundesland aus dem amtlichen Kreisschlüssel; Stadtteile („Dresden Innere Altstadt“) werden als solche markiert.
- Namenssuche wie bei einer Suchmaschine: Groß-/Kleinschreibung, Umlaute (ü/ue/u), Bindestriche, Satzzeichen und Füllwörter („in“, „an der“, „i.“) spielen keine Rolle; „Sankt“ = „St.“.
- Jedes Suchwort muss passen – im Ortsnamen oder im Umfeld: Bundesland mit üblichen Kürzeln (Sa., Thür., Westf., Opf. …), Regierungsbezirk, Landkreis, Postleitzahl. „Neustadt Sachsen“, „Neustadt i. Sa.“ und „Neustadt 01844“ finden Neustadt in Sachsen.
- Tippfehler (ein Fehler ab 4, zwei ab 8 Buchstaben, auch vertauschte Buchstaben) werden nur berücksichtigt, wenn nichts genau passt.
- Reihenfolge: genaue Treffer vor Wortanfängen vor Tippfehlern, Treffer im Namen vor Treffern im Umfeld, Orte vor Stadtteilen, dann nach Einwohnern.
- Große Städte heißen bei GeoNames teils anders („Munich“, „Halle (Saale)“); dieser Name wird mitgespeichert und ist ebenfalls suchbar.
- Umkehrsuche: nächster Postleitzahl-Punkt im Umkreis von 25 km; ein Stadtteil wird dem zugehörigen Ort zugeordnet. Zurück kommen die gerundeten Koordinaten des Nutzers.
- Koordinaten werden auf 2 Nachkommastellen (≈ 1 km) gerundet.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `orte` | Treffer, beste zuerst (höchstens 6; Umkehrsuche höchstens 1) |
| `orte[].name` | Ortsname |
| `orte[].region` | Bundesland bzw. Region |
| `orte[].land` | Ländercode ISO 3166-1 (DE, AT …) |
| `orte[].kreis` | Landkreis bzw. kreisfreie Stadt |
| `orte[].kreisSchluessel` | amtlicher Kreisschlüssel (5 Stellen, nur Deutschland) |
| `orte[].plz` | Postleitzahlen des Orts (bei PLZ- und Umkehrsuche nur die passende) |
| `orte[].einwohner` | Einwohnerzahl laut GeoNames, soweit bekannt, sonst null |
| `orte[].typ` | ort oder stadtteil |
| `orte[].lat` | Breitengrad, 2 Nachkommastellen |
| `orte[].lon` | Längengrad, 2 Nachkommastellen |
| `orte[].zeitzone` | IANA-Zeitzone |

Hinweise (`hinweise`):
- `ausland`: Ergebnis enthält Orte aus der Auslandssuche
- `ausland_nicht_verfuegbar`: Auslandssuche gerade nicht erreichbar, nur deutsche Treffer
- `ausserhalb`: Koordinaten liegen außerhalb Deutschlands (Umkehrsuche nur in Deutschland)

## Skalierung
| | |
|---|---|
| Klasse | D – je Eingabe – jede Eingabe ist eigen (Suche, Liste) |
| Quelle | Deutschland ohne externe Quelle – unbegrenzt. Ausland: Open-Meteo frei bis 10.000 Aufrufe/Tag (nicht kommerziell), danach ab 29 $/Monat; betrifft nur Suchen ohne passenden deutschen Ort. |
| Kosten | Rechenzeit der Funktion: Laden des Bestands ≈ 60 ms je Kaltstart, Suche < 5 ms. Keine Gebühren an Dritte (Deutschland). |
| Cache | CDN 24 h je Suchbegriff bzw. gerundeter Koordinate; der Browser speichert den gewählten Ort dauerhaft – die Suche fällt nur beim Einrichten an. |
| Bei 10 Mio. Aufrufen/Tag | Unkritisch: Ortssuche passiert beim Einrichten, nicht bei jedem Aufruf. Andere Dienste bekommen lat/lon direkt. Ausland ggf. eigener Bestand (GeoNames allCountries) statt Open-Meteo. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.4.0 | 2026-10-02 | Koordinaten der Umkehrsuche mit höchstens 2 Nachkommastellen; land nur DE. Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.3.2 | 2026-09-27 | Ortsbestand ist eine feste Datei – keine monatliche Action mehr (Orte ändern sich kaum); bei Bedarf einmalig mit tools/orte-daten.js neu erzeugen |
| 1.3.1 | 2026-09-27 | Ortsbestand wird jetzt über die gemeinsame Action „Daten erneuern“ erzeugt (Dienstblatt angepasst) |
| 1.3.0 | 2026-09-27 | Doppelte zusammengefasst, Stadtstaaten korrigiert, weitere Firmennamen gefiltert |
| 1.2.0 | 2026-09-27 | Suche wie eine Suchmaschine (Kürzel, Umlaute, Tippfehler), Einwohnerzahlen, Vorschläge beim Tippen (land=DE) |
| 1.1.0 | 2026-09-27 | Eigener Ortsbestand aus GeoNames statt OpenPLZ und Nominatim; Ausland über Open-Meteo |
| 1.0.0 | 2026-09-27 | Erste Fassung: Name (Open-Meteo), Postleitzahl (OpenPLZ), Gerätestandort (Nominatim) |

