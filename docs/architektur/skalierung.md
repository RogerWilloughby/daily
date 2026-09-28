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
| **C** | je Ort, rasterbar | Wetter, Wetterhinweise, Tanken | Zahl der belegten Zellen × Aktualisierungen/Tag entscheidet; Raster und TTL sind die Stellschrauben, am Ende eigene Daten |
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
| `wetter` | C | Open-Meteo frei (10.000/Tag, nicht kommerziell) reicht nicht | jetzt: nur auf Anfrage, Takt :00/:30 (≈ 100 Orte/Tag im freien Kontingent). Bei Wachstum: DWD MOSMIX (Abrufe unabhängig von Nutzern), gröberes Raster oder bezahlter Tarif | Stufe 1–2 |
| `regen` | C | Bright Sky ohne veröffentlichte Grenze, ohne Zusage | nur auf Anfrage, Takt 5 min (≤ 288 Abrufe je 1-km-Zelle und Tag). Bei Wachstum: Bright Sky selbst betreiben oder DWD-RV-Datei zentral alle 5 min laden (288 Abrufe/Tag gesamt) | Stufe 1–2 |
| `wetterhinweise` | C | Bright Sky ohne veröffentlichte Grenze, ohne Zusage | nur auf Anfrage im Paket mit Wetter/Regen, Takt 5 min. Bei Wachstum: DWD-Warnliste zentral alle 5 min laden und je Warnzelle (≈ 11.000 Gemeinden) vorhalten – Abrufe unabhängig von der Nutzerzahl | Stufe 1–2 |
| `feiertage` | B | OpenHolidays frei, ohne Grenze; Rest gerechnet | Takt 1 Tag, je Bundesland höchstens 1 Ferien-Abruf am Tag (16 Länder) | Stufe 1–2 |
| `himmel` | A | keine Quelle (Astronomy Engine) | Takt 1 Stunde, ≈ 20–40 ms Rechenzeit je Ort; bei Bedarf je 1°-Feld vorrechnen | Stufe 1 |
| `namenstage` | A | keine (feste Liste beim Dienst) | Takt 1 Tag, für alle gleich | Stufe 1 |
| `finanzen` | B | EZB (Kursdatei + 2 CSV), frei | Takt 1 Std., für alle gleich → 72 EZB-Abrufe/Tag | Stufe 1 |
| `kurse` | B | Yahoo, inoffiziell | nur privat, kein CDN-Cache, alle 15 min | – (nicht öffentlich) |
| `termine` | D | Kalender-Server der Nutzer, je Abruf 1 Anfrage je Kalender | nur privat, kein Cache (private Daten), alle 10 min | – (nicht öffentlich) |

Weitere Dienste werden beim Umzug auf daily/1 hier eingetragen.

## Performance: Worauf es ankommt (Stand 27.09.2026)
Ziel: Die Seite darf bei vielen Nutzern nicht langsamer werden. Die Plattform ist dafür zweitrangig – alle großen Anbieter skalieren automatisch (Vercel: bis 30.000 gleichzeitige Funktionen, Zuwachs 1.000 je 10 s und Region).

**Bleibt schnell:** Seite und Skripte (CDN, Service Worker); Kacheldaten im Normalfall (CDN-Treffer, abgelaufene Antworten per `stale-while-revalidate` sofort, Erneuerung im Hintergrund).

**Kann einbrechen:** (1) die Quellen (Open-Meteo 600/min, Bright Sky ohne Zusage) → Fehler oder Wartezeit; (2) gleichzeitiger Ablauf zum Takt (:00/:30, alle 5 min) → viele Erneuerungen auf einmal (Vercel bündelt gleiche Anfragen nur bei ISR, nicht bei unseren Funktionen); (3) viele Einzelanfragen auf dem Handy.

**Umgesetzt (DAILY 0.9.0):**
1. *Sofort anzeigen, dann auffrischen:* Der Browser speichert die letzte gute Antwort je Anfrage (`localStorage`, höchstens 30). Beim Öffnen erscheint sofort dieser Stand, die Kachel zeigt „Stand 10:30“, solange er älter ist; neue Daten kommen im Hintergrund. Fällt eine Quelle aus (nicht erreichbar, Quellfehler), bleibt der letzte Stand sichtbar statt einer leeren Kachel (`src/js/dienste/client.js`).
2. *Messen:* Jede Anfrage misst ihre Ladezeit; die Statusanzeige zeigt sie beim Überfahren („Ladezeiten: paket 243 ms“, mit Hinweis Speicher/Rückfall).
3. *Bündeln:* `GET /api/v1/paket?dienste=wetter,regen&lat=…&lon=…` liefert mehrere Dienste in einer Anfrage; Fehler betreffen nur den eigenen Teil; gültig bis zum frühesten Takt. Der Client holt nur abgelaufene Teile. Die Wetterkachel nutzt es; weitere Kacheln kommen beim Umzug dazu.
4. *Instanz-Zwischenspeicher auf dem Server:* gleiche Anfragen innerhalb einer laufenden Funktion teilen sich eine Berechnung und das Ergebnis bis `gueltigBis` – dämpft den Andrang auf die Quellen zum Takt.

**Vor dem öffentlichen Start:** eigene Daten für Wetter und Radar (zentral je Takt laden, Stufe 4) und ein Lasttest (Vercel-Regeln für Lasttests beachten).

## Betrieb: Vercel, AWS oder Cloudflare (Stand 27.09.2026)
Preise laut Anbieterseiten im September 2026 (Listenpreise in USD, gerundet; Quellen unten). Überschlagsrechnung, keine Angebote.

### Annahmen
- **Ein Aufruf von DAILY** = 1 Seitenabruf + ≈ 15 Dienst-Anfragen (eine je Kachel). 3 Aufrufe je Nutzer und Tag.
- **Treffer im CDN-Cache:** Dienste werden nur neu berechnet, wenn der Takt abgelaufen ist (Wetter 30 min, Regen 5 min je 1-km-Zelle). Funktionsaufrufe ≈ belegte Zellen × Takte/Tag; Laufzeit ≈ 15 ms CPU, 250 ms Wartezeit auf die Quelle.
- **S1 „10 Mio. Aufrufe/Tag“** (≈ 200.000 Nutzer/Tag): ≈ 300 Mio. Anfragen/Monat, ≈ 30 Mio. Funktionsaufrufe.
- **S2 „10 Mio. Nutzer/Tag“:** ≈ 14 Mrd. Anfragen/Monat; mit gebündelten Anfragen (1 Anfrage je Aufruf statt 16) ≈ 0,9 Mrd.; ≈ 1,2 Mrd. Funktionsaufrufe (≈ 100.000 belegte Zellen; Regen allein 288 Takte/Tag).

### Preisbausteine
| | Vercel Pro | AWS (CloudFront + Lambda) | Cloudflare Workers |
|---|---|---|---|
| Grundpreis | 20 $/Monat | – | 5 $/Monat |
| CDN-Anfragen und Datenmenge | Flat Rate CDN: 1 Mio./1 TB inklusive; 10 Mio. 20 $, 50 Mio. 100 $, 150 Mio. 300 $; darüber nach Verbrauch (ab 0,50 $/Mio. Anfragen, 0,06 $/GB) | Flat Rate: Free 1 Mio./100 GB, Pro 15 $ (10 Mio.), Business 200 $ (125 Mio.), Premium ab 1.000 $ (500 Mio.) bis 10.000 $ (6 Mrd.) | Datenübertragung kostenlos; Anfragen an den Worker 0,30 $/Mio. (10 Mio. inklusive) |
| Rechenzeit | 1 Mio. Aufrufe inkl., dann 0,60 $/Mio.; CPU 0,128 $/h; Speicher 0,0106 $/GB-h | 0,20 $/Mio. Aufrufe; Rechenzeit je GB-Sekunde (1 Mio. Aufrufe + 400.000 GB-s frei) | 30 Mio. CPU-ms inkl., dann 0,02 $/Mio. CPU-ms (Wartezeit auf Quellen kostet nichts) |
| Nicht kommerziell kostenlos | Hobby (fest begrenzt, kein Zukauf) | Free-Stufen | Free (100.000 Anfragen/Tag) |

### Grobe Monatskosten
| Szenario | Vercel | AWS | Cloudflare |
|---|---|---|---|
| heute (privat, wenige Nutzer) | 0 $ (Hobby) | ≈ 0 $ | 0 $ |
| S1: 10 Mio. Aufrufe/Tag | ≈ 400 $ | ≈ 650 $ (+ Einrichtung/Betrieb) | ≈ 100 $ |
| S2 ungebündelt (14 Mrd. Anfragen) | ≈ 18.000 $ → Enterprise-Vertrag | ≈ 15.000 $ → Sondervertrag | ≈ 4.500 $ |
| S2 gebündelt (0,9 Mrd. Anfragen) | ≈ 4.000 $ | ≈ 3.500 $ | ≈ 400 $ |

### Bewertung
1. **Der Kostentreiber ist die Zahl der Anfragen, nicht die Rechenzeit.** Die wirksamste Maßnahme ist plattformunabhängig: **Anfragen bündeln** (eine Anfrage je Aufruf für alle Kacheln, z. B. `/api/v1/paket?dienste=wetter,regen,…`) und die Browser-Zwischenspeicherung bis `gueltigBis` nutzen – das senkt die Anfragen etwa um den Faktor 15.
2. **Quellen skalieren nicht mit:** Bei S2 müssen Regen (Radar) und Wetter zentral geladen und gespeichert werden (Stufe 4: einmal je 5 bzw. 30 Minuten für ganz Deutschland, Ablage in einem gemeinsamen Speicher). Das ist auf jeder Plattform nötig und braucht zeitgesteuerte Aufgaben (Vercel Cron auf Pro, AWS EventBridge, Cloudflare Cron Triggers).
3. **Vercel** reicht technisch bis S2; bis S1 günstig und ohne Betriebsaufwand, darüber teurer als die Alternativen. Hobby ist nur für nicht kommerzielle Nutzung.
4. **AWS** lohnt sich für DAILY nicht: ähnliche Kosten wie Vercel, aber deutlich mehr Einrichtung und Betrieb (CloudFront, Lambda, IAM, Logs). Sinnvoll erst, wenn Dinge gebraucht werden, die Vercel nicht bietet (lange laufende Jobs, Datenbank im selben Netz, Sonderverträge).
5. **Cloudflare Workers** ist bei großer Last mit Abstand am günstigsten (keine Kosten für Datenmenge, Wartezeit kostenlos). Umzug machbar: Dienste sind reine Funktionen ohne Vercel-Besonderheiten (nur `zlib` und `fetch`; Workers mit Node-Kompatibilität).
6. **Entscheidung 27.09.2026 (Performance ist das Ziel, nicht die Kosten):** Bei Vercel bleiben (Hobby, solange privat; Pro beim öffentlichen Start). Architektur portabel halten (keine Vercel-spezifischen Dienste). Bündeln einbauen, bevor DAILY öffentlich wird. Bei etwa 150 Mio. Anfragen/Monat (oberste Flat-Rate-Stufe) Cloudflare als Umzugsziel neu bewerten.

Quellen: [Vercel Pricing](https://vercel.com/pricing), [Vercel Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn), [CloudFront Flat-Rate-Pläne](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html), [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/), [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/).
