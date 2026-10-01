# Dienst `tanken` – Tanken

> Erzeugt aus `services/tanken.js` mit `npm run doku` – nicht von Hand bearbeiten.

Spritpreise (Super E5, Super E10, Diesel) der Tankstellen im Umkreis eines Orts in Deutschland, mit der günstigsten geöffneten Tankstelle und dem Durchschnittspreis je Sorte.

| | |
|---|---|
| Aufruf | `GET /api/v1/tanken` |
| Programmversion | 2.1.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | DE |
| Gültigkeit | bis zum nächsten Takt von 5 min (z. B. :00/:30) |

## Zweck
Beantwortet „Wo tanke ich gerade am günstigsten?“: Preise der Tankstellen im Umkreis, die günstigste geöffnete je Sorte und der Durchschnittspreis – für die Kachel „Verkehr“ (Ansicht Tanken) und Frag DAILY.

## Herkunft der Daten
- Markttransparenzstelle für Kraftstoffe (MTS-K) beim Bundeskartellamt: Tankstellen in Deutschland müssen jede Preisänderung für Super E5, Super E10 und Diesel innerhalb von 5 Minuten melden.
- Abgerufen über die Tankerkönig-API (list.php, alle Sorten): kostenlos mit Schlüssel, Daten unter CC BY 4.0, Abfragegrenze je Schlüssel (nicht veröffentlicht), ohne Gewähr. Die Weitergabe der Datensätze als solche ist laut Nutzungsbedingungen nicht gestattet – DAILY zeigt sie nur in der eigenen Oberfläche an.

Quellen mit Lizenz:
- Tankerkönig (Daten der Markttransparenzstelle für Kraftstoffe) (CC BY 4.0) – https://creativecommons.tankerkoenig.de

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `lat` | Breitengrad, höchstens 2 Nachkommastellen (z. B. 51.05) |
| `lon` | Längengrad, höchstens 2 Nachkommastellen (z. B. 13.74) |
| `umkreis` | Umkreis in km: 2, 5 (Standard) oder 10 |

## Verarbeitung
- Ort nur als lat/lon mit höchstens 2 Nachkommastellen (≈ 1 km); Umkreis 2, 5 (Standard) oder 10 km, andere Werte und Angaben werden abgelehnt. Außerhalb Deutschlands (grober Rahmen um Deutschland): nicht_unterstuetzt.
- Ein Abruf mit allen drei Sorten; Preise ≤ 0 oder fehlend → null. Tankstellen nach Entfernung sortiert, höchstens die nächsten 25.
- Günstigste je Sorte: nur geöffnete Tankstellen mit Preis, bei gleichem Preis die nähere. Durchschnitt: Mittel der geöffneten mit Preis.
- Takt: Antworten gelten bis zur nächsten 5-Minuten-Marke (die Meldepflicht der Tankstellen liegt bei 5 Minuten).
- Ohne Schlüssel (Vercel-Variable TANKERKOENIG_API_KEY) antwortet der Dienst mit dem Fehler schluessel_fehlt.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `umkreisKm` | Umkreis der Suche in km |
| `anzahl` | Tankstellen im Umkreis |
| `anzahlOffen` | davon gerade geöffnet |
| `guenstigste` | günstigste geöffnete Tankstelle je Sorte (null: keine mit Preis) |
| `guenstigste.e5` | Super E5 |
| `guenstigste.e5.id` | Kennung der Tankstelle (siehe stationen) |
| `guenstigste.e5.preis` | Preis in € je Liter |
| `guenstigste.e5.entfernungKm` | Entfernung in km |
| `guenstigste.e10` | Super E10 (Felder wie e5) |
| `guenstigste.e10.id` | Kennung der Tankstelle |
| `guenstigste.e10.preis` | Preis in € je Liter |
| `guenstigste.e10.entfernungKm` | Entfernung in km |
| `guenstigste.diesel` | Diesel (Felder wie e5) |
| `guenstigste.diesel.id` | Kennung der Tankstelle |
| `guenstigste.diesel.preis` | Preis in € je Liter |
| `guenstigste.diesel.entfernungKm` | Entfernung in km |
| `durchschnitt` | Durchschnittspreis der geöffneten Tankstellen je Sorte in € je Liter (null: keine) |
| `durchschnitt.e5` | Super E5 |
| `durchschnitt.e10` | Super E10 |
| `durchschnitt.diesel` | Diesel |
| `stationen` | Tankstellen im Umkreis, nach Entfernung sortiert (höchstens 25) |
| `stationen[].id` | Kennung der Tankstelle (MTS-K) |
| `stationen[].marke` | Marke (z. B. ARAL), null bei freien Tankstellen ohne Marke |
| `stationen[].name` | Name der Tankstelle |
| `stationen[].strasse` | Straße und Hausnummer |
| `stationen[].plz` | Postleitzahl |
| `stationen[].ort` | Ort |
| `stationen[].lat` | Breitengrad |
| `stationen[].lon` | Längengrad |
| `stationen[].entfernungKm` | Entfernung vom Ort in km |
| `stationen[].offen` | true, wenn gerade geöffnet |
| `stationen[].preise` | Preise in € je Liter (null: Sorte nicht im Angebot oder kein Preis) |
| `stationen[].preise.e5` | Super E5 |
| `stationen[].preise.e10` | Super E10 |
| `stationen[].preise.diesel` | Diesel |

## Skalierung
| | |
|---|---|
| Klasse | C – je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar |
| Quelle | Tankerkönig: kostenlos mit Schlüssel, Abfragegrenze je Schlüssel (nicht veröffentlicht), ohne Verfügbarkeitszusage. Bremse: höchstens 30 Abrufe je Minute und Funktion (darüber quelle_fehler, 60 s gemerkt). |
| Kosten | Je Aktualisierung 1 Abruf (alle Sorten), Auswertung < 1 ms. |
| Cache | Nur auf Anfrage; CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke. Je belegter 1-km-Zelle und Umkreis höchstens 288 Abrufe/Tag. |
| Bei 10 Mio. Aufrufen/Tag | Nicht mit einem Tankerkönig-Schlüssel: bei z. B. 20.000 belegten Zellen wären es bis zu 5,8 Mio. Abrufe/Tag. Weg: DAILY als Verbraucher-Informationsdienst bei der MTS-K zulassen und die Preisdaten zentral beziehen (Abrufe unabhängig von der Nutzerzahl), dann Umkreissuche im eigenen Speicher. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 2.1.0 | 2026-10-02 | Bremse: höchstens 30 Abrufe bei Tankerkönig je Minute und Funktion; darüber quelle_fehler (Oberfläche zeigt den letzten Stand). |
| 2.0.0 | 2026-10-02 | Eingaben nur noch lat/lon mit höchstens 2 Nachkommastellen; Ortssuche per Name (ort=) sowie name, region, land, zeitzone entfallen – die Antwort enthält keinen Ortsnamen mehr (den kennt die Oberfläche). Umkreis nur 2, 5 oder 10 (sonst Fehler statt still 5). Ausland an den Koordinaten erkannt (Rahmen um Deutschland). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-09-29 | Erste Fassung im Format daily/1 (ersetzt /api/fuel): alle drei Sorten mit einem Abruf, Umkreis 2/5/10 km, günstigste und Durchschnitt je Sorte |

