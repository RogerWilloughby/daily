# Dienst `autobahn` – Autobahn

> Erzeugt aus `services/autobahn.js` mit `npm run doku` – nicht von Hand bearbeiten.

Aktuelle Staus, Verkehrsmeldungen, Sperrungen und Baustellen auf den gewählten Autobahnen in Deutschland – für den Arbeitsweg mit dem Auto.

| | |
|---|---|
| Aufruf | `GET /api/v1/autobahn` |
| Programmversion | 1.1.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | DE |
| Gültigkeit | bis zum nächsten Takt von 5 min (z. B. :00/:30) |

## Zweck
Beantwortet „Komme ich heute gut zur Arbeit?“ für Autofahrer: was auf den gewählten Autobahnen los ist – Staus mit Verzögerung, Sperrungen (auch geplante), Tages- und Dauerbaustellen. Für die Kachel „Verkehr“ (Ansicht Arbeitsweg) und Frag DAILY. Start und Ziel des Arbeitswegs bleiben im Browser: der Dienst kennt nur die Autobahnen, den Abschnitt zwischen Start und Ziel wählt die Oberfläche aus.

## Herkunft der Daten
- Autobahn-API der Autobahn GmbH des Bundes (verkehr.autobahn.de, beschrieben auf autobahn.api.bund.dev): je Autobahn Verkehrsmeldungen (warning), Sperrungen (closure) und Baustellen (roadworks). Frei abrufbar ohne Schlüssel; eine Lizenz oder Abfragegrenze ist nicht veröffentlicht.
- Verkehrsmeldungen stammen laut Feld „source“ teils vom kommerziellen Anbieter INRIX. Vor dem öffentlichen Start klären, ob die Anzeige erlaubt ist (docs/recht/checkliste.md).
- Angaben ohne Gewähr; Fahrzeiten mit Live-Verkehr liefert die Quelle nicht.

Quellen mit Lizenz:
- Die Autobahn GmbH des Bundes (Autobahn-API) (ohne Angabe) – https://verkehr.autobahn.de

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `strassen` | Autobahnen, durch Komma getrennt, aufsteigend und ohne Doppelte (z. B. A4,A13), höchstens 5 |

## Verarbeitung
- Eingabe: bis zu 5 Autobahnen (A1 … A999), Schreibweise egal („a4, A 13“), sortiert und ohne Doppelte – gleiche Auswahl, gleiche Antwort.
- Je Autobahn 3 Abrufe (Meldungen, Sperrungen, Baustellen) parallel; Autobahnen ohne Antwort stehen in „fehlend“, fehlt nur ein Teil, kommt der Hinweis meldungen_unvollstaendig.
- Art aus der Anzeige-Art der Quelle: Stau (Verkehrslage oder Verzögerung), sonstige Meldung, Sperrung, Anschlusssperrung, Tagesbaustelle, Baustelle. Abschnitt aus dem Titel, Richtung aus dem Untertitel.
- Beginn, Ende, Zeiträume (Ortszeit → UTC), Länge und Höchstgeschwindigkeit stehen bei der Quelle nur im Text und werden daraus gelesen; was nicht passt, bleibt null. Der amtliche Text bleibt unverändert (höchstens 10 Zeilen, ohne Leerzeilen).
- Koordinaten auf 4 Nachkommastellen, Linienverlauf (Geometrie) weggelassen – hält die Antwort klein.
- Reihenfolge: Autobahn, dann Bedeutung (Stau, Meldung, Sperrung, Anschlusssperrung, Tagesbaustelle, Baustelle), dann größere Verzögerung, dann früherer Beginn.
- Takt: Antworten gelten bis zur nächsten 5-Minuten-Marke; zusätzlich merkt sich die laufende Funktion jede Autobahn bis dahin (verschiedene Auswahlen teilen sich die Abrufe).

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `strassen` | abgefragte Autobahnen (sortiert) |
| `fehlend` | Autobahnen, zu denen die Quelle nichts geliefert hat |
| `meldungen` | Meldungen aller abgefragten Autobahnen, sortiert nach Autobahn und Bedeutung |
| `meldungen[].id` | Kennung der Meldung (Quelle) |
| `meldungen[].strasse` | Autobahn, z. B. A4 |
| `meldungen[].typ` | stau, meldung, sperrung, anschlusssperrung, tagesbaustelle oder baustelle |
| `meldungen[].lage` | Verkehrslage bei Staus: langsam, stockend oder stau (null: keine Angabe) |
| `meldungen[].von` | Abschnitt von (Anschlussstelle, Dreieck, Kreuz) |
| `meldungen[].bis` | Abschnitt bis (null, wenn der Titel keinen Abschnitt nennt) |
| `meldungen[].richtung` | Fahrtrichtung |
| `meldungen[].richtung.von` | Richtung von (z. B. Dresden) |
| `meldungen[].richtung.nach` | Richtung nach (z. B. Chemnitz) |
| `meldungen[].lat` | Breitengrad des Anfangs |
| `meldungen[].lon` | Längengrad des Anfangs |
| `meldungen[].lat2` | Breitengrad des anderen Endes (null: unbekannt) |
| `meldungen[].lon2` | Längengrad des anderen Endes |
| `meldungen[].verzoegerungMin` | Verzögerung in Minuten (nur Staus, null: keine Angabe) |
| `meldungen[].tempoKmh` | Durchschnittsgeschwindigkeit im Stau bzw. Höchstgeschwindigkeit an der Baustelle in km/h |
| `meldungen[].laengeKm` | Länge in km (aus dem Text) |
| `meldungen[].gesperrt` | true, wenn die Fahrbahn laut Quelle gesperrt ist |
| `meldungen[].kuenftig` | true, wenn die Maßnahme noch nicht begonnen hat |
| `meldungen[].beginn` | Beginn (UTC) |
| `meldungen[].ende` | Ende (UTC, null: unbekannt) |
| `meldungen[].zeitraeume` | einzelne Zeiträume bei wiederkehrenden Sperrungen (z. B. nachts), höchstens 10 |
| `meldungen[].zeitraeume[].beginn` | Beginn des Zeitraums (UTC) |
| `meldungen[].zeitraeume[].ende` | Ende des Zeitraums (UTC) |
| `meldungen[].text` | amtlicher Text der Quelle, Zeile für Zeile |
| `meldungen[].anbieter` | Datenlieferant laut Quelle (z. B. inrix), null: Autobahn GmbH |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | Autobahn-API: ohne Schlüssel, keine veröffentlichte Abfragegrenze, keine Verfügbarkeitszusage. |
| Kosten | Je Autobahn 3 Abrufe je 5 Minuten, Auswertung < 5 ms. |
| Cache | CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke (je Auswahl); die Funktion merkt sich jede Autobahn bis dahin. Höchstens ≈ 110 Autobahnen × 3 Abrufe × 288 = ≈ 95.000 Abrufe/Tag je Funktions-Instanz – unabhängig von der Zahl der Nutzer. |
| Bei 10 Mio. Aufrufen/Tag | Tragbar: die Abrufe hängen an den Autobahnen, nicht an den Nutzern; die Last trägt das CDN. Viele verschiedene Auswahlen verteilen sich auf viele Cache-Schlüssel – Ausweg bei Bedarf: je Autobahn eine eigene Anfrage (/api/v1/autobahn?strassen=A4), die der Browser zusammenführt. Offen bleibt die Nutzungserlaubnis für den öffentlichen Betrieb (INRIX). |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.1.0 | 2026-10-02 | Autobahnen nur in einer Schreibweise: aufsteigend, ohne Doppelte (A4,A13 – nicht A13,A4). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-09-29 | Erste Fassung: Staus, Verkehrsmeldungen, Sperrungen und Baustellen der gewählten Autobahnen (bis 5), Beginn/Ende/Länge/Tempo aus dem amtlichen Text |

