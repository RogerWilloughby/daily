# DAILY – Skalierung der Dienste

Stand 27.09.2026. Frage für jeden Dienst: **Was passiert bei 10 Millionen Aufrufen am Tag?** Kann die Quelle das leisten, entstehen Kosten, müssen wir Daten selbst halten? Die Antwort steht je Dienst im Dienstblatt (`blatt.skalierung`, siehe `../dienste/`). Dieses Dokument ist der gemeinsame Rahmen.

10 Mio. Aufrufe/Tag sind im Mittel ≈ 116 pro Sekunde, morgens zur Spitze eher 500–1.000 pro Sekunde.

## Vier Cache-Stufen
Jede Anfrage soll so früh wie möglich beantwortet werden:

| Stufe | Wo | Wie lange | Wirkung |
|---|---|---|---|
| 1 Browser | `src/js/dienste/client.js` hält jede Antwort bis `gueltigBis`; der Ort steht dauerhaft in den Einstellungen | bis TTL | wiederholtes Öffnen kostet nichts |
| 2 CDN | Vercel Edge nach `Cache-Control: s-maxage=<ttl>` – gleiche URL = eine Antwort für alle | TTL | Koordinaten auf 2 Stellen gerundet ⇒ alle Nutzer einer ≈ 1-km-Zelle teilen sich einen Abruf |
| 3 gemeinsamer Speicher | z. B. Redis/KV: Ergebnis der Quelle je Zelle/Region, auch über CDN-Knoten hinweg | TTL der Quelle | nötig, wenn viele CDN-Knoten dieselbe Quelle einzeln anfragen würden |
| 4 eigene Daten | Datei oder Datenbank beim Dienst, regelmäßig aus Open Data erzeugt | bis zur nächsten Aktualisierung | keine Abhängigkeit von fremden Grenzen und Tarifen |

## Vier Klassen von Diensten
| Klasse | Art | Beispiel | Folge für 10 Mio./Tag |
|---|---|---|---|
| **A** | berechnet, ohne Quelle | Himmel, Feiertage | unkritisch, nur Rechenzeit |
| **B** | für alle gleich | Strompreis, Währungen, An diesem Tag | ein Abruf je Zeitraum, CDN verteilt – unkritisch |
| **C** | je Ort, rasterbar | Wetter, Warnungen, Tanken | Zahl der belegten Zellen × Aktualisierungen/Tag entscheidet; Raster und TTL sind die Stellschrauben, am Ende eigene Daten |
| **D** | je Eingabe | Ortssuche, Fußballverein, Haltestelle | CDN hilft nur bei häufigen Eingaben; möglichst eigener Bestand (Stufe 4) |

## Drei Ausbaustufen
| Stufe | Nutzung | Betrieb |
|---|---|---|
| 1 privat | bis ≈ 10.000 Aufrufe/Tag | Vercel Hobby, freie Quellen, Stufen 1–2 |
| 2 öffentlich | bis ≈ 1 Mio. Aufrufe/Tag | Vercel Pro (kommerziell zulässig), bezahlte Tarife wo nötig, Stufe 3 für Klasse C |
| 3 groß | 10 Mio.+ Aufrufe/Tag | eigene Daten (Stufe 4) für Klasse C und D, Kostenvergleich Vercel ↔ AWS (offen, eigener Punkt) |

Hinweis: Vercel Hobby und das freie Open-Meteo sind nur für **nicht kommerzielle** Nutzung gedacht. Vor einem öffentlichen, werbe- oder bezahlfinanzierten Betrieb müssen beide umgestellt werden.

## Bewertung je Dienst
| Dienst | Klasse | Quelle bei 10 Mio./Tag | Maßnahme | Stand |
|---|---|---|---|---|
| `ort` | D | Deutschland: keine externe Quelle (eigener Bestand) | erledigt: eigener GeoNames-Bestand, monatliche Aktualisierung; Ausland nur ohne deutschen Treffer | ✅ Stufe 4 |
| `wetter` | C | Open-Meteo frei (10.000/Tag) reicht nicht | gröberes Raster/TTL, bezahlter Tarif oder DWD-Open-Data selbst aufbereiten | offen – nächster Schritt |

Weitere Dienste werden beim Umzug auf daily/1 hier eingetragen.
