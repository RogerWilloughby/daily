# DAILY – Architektur: Dienste und Darstellung (headless)

Stand 27.09.2026. Gilt für alle neuen Dienste; bestehende Kacheln werden schrittweise umgezogen.

## Grundidee
DAILY trennt **Daten** von **Darstellung**:

1. **Dienste** (`services/`, auf dem Server): bekommen Eingaben (meist einen Ort), holen oder berechnen Daten und liefern sie im einheitlichen Austauschformat **daily/1** zurück. Keine fertigen Sätze, keine Formatierung.
2. **Adapter** (`src/js/adapter/`, im Browser): übersetzen einen Dienst in eine Darstellung – z. B. `kachel()`, `antwort()` (Frag DAILY), später `liste()`, `dashboard()`.
3. **Oberflächen**: das Kachelraster (zum Testen), später Liste, Dashboard oder Varianten für verschiedene Nutzergruppen. Alle nutzen dieselben Dienste.

Externe Quellen (Open-Meteo, DWD, OpenLigaDB …) haben jede ihr eigenes Format. Der Dienst passt ihre Werte an **unsere** Schnittstelle an; Oberflächen sehen die Quelle nie direkt. Wechselt eine Quelle, ändert sich nur der Dienst.

## Aufruf
```
GET /api/v1/<dienst>?<eingaben>
GET /api/v1/dienste            → Katalog aller Dienste (mit Eingaben, Klasse, TTL, Quellen, Schema)
GET /api/v1/paket?dienste=wetter,regen,wetterhinweise&lat=…&lon=…  → mehrere Dienste in einer Anfrage (daten.antworten[id] = Rahmen je Dienst)
```
Eine einzige Vercel-Funktion (`api/v1/[dienst].js`) bedient alle Dienste (Grenze Hobby-Tarif: 12 Funktionen).

## Austauschformat daily/1 (Rahmen)
Jede Antwort – auch jeder Fehler – hat diese Form:

```json
{
  "format": "daily/1",
  "dienst": "wetter",
  "version": 1,
  "ort": { "name": "Berlin", "region": "Berlin", "land": "DE", "lat": 52.52, "lon": 13.41, "zeitzone": "Europe/Berlin" },
  "erstellt": "2026-09-27T06:15:00Z",
  "gueltigBis": "2026-09-27T06:30:00Z",
  "quellen": [ { "name": "Open-Meteo", "lizenz": "CC BY 4.0", "url": "https://open-meteo.com" } ],
  "hinweise": [],
  "daten": { },
  "fehler": null
}
```

| Feld | Bedeutung |
|---|---|
| `format` | immer `daily/1` (Version des Rahmens) |
| `dienst`, `version` | Kennung und Version des Datenvertrags; neue Felder = gleiche Version, geänderte/entfernte Felder = neue Version |
| `programm` | Programmversion des Dienstes (`x.y.z`), steigt bei jeder Änderung |
| `ort` | aufgelöster Ort oder `null` bei ortsunabhängigen Diensten |
| `erstellt`, `gueltigBis` | ab wann die Daten veraltet sind (Oberflächen und Cache richten sich danach) |
| `quellen` | Pflicht für Quellenangabe/Lizenz in jeder Oberfläche |
| `hinweise` | maschinenlesbare Codes für Teilausfälle, z. B. `luft_nicht_verfuegbar` |
| `daten` | der eigentliche Inhalt, je Dienst per Schema festgelegt; bei Fehler `null` |
| `fehler` | `null` oder `{ "code": "...", "meldung": "..." }` |

### Fehlercodes
| Code | HTTP | Bedeutung |
|---|---|---|
| `eingabe_fehlt` | 400 | Pflichtangabe fehlt |
| `eingabe_ungueltig` | 400 | Angabe unbrauchbar (auch falsche Methode: 405) |
| `dienst_unbekannt` | 404 | Dienst gibt es nicht |
| `nur_privat` | 404 | Dienst nur im privaten Betrieb |
| `ort_nicht_gefunden` | 404 | Ortsname nicht auflösbar |
| `nicht_unterstuetzt` | 422 | Dienst deckt das Land des Orts nicht ab (siehe `laender` im Katalog) |
| `schluessel_fehlt` | 503 | Betreiber-Schlüssel (z. B. Tankerkönig) nicht eingerichtet |
| `quelle_fehler` | 502 | externe Quelle nicht erreichbar oder fehlerhaft |
| `intern` | 500 | Programmfehler |

## Regeln für `daten`
- **Reine Daten**: Zahlen, Codes, Aufzählungswerte – keine Sätze („Regen möglich gegen 17 Uhr“ baut der Adapter).
- **Feldnamen** deutsch, camelCase, nur ASCII (`gefuehltC`, `graeser`).
- **Einheit im Feldnamen**: `tempC`, `windKmh`, `niederschlagMm`, `regenProzent`, `preisEur`, `entfernungKm`.
- **Zeitpunkte**: ISO 8601 in UTC mit `Z` (`2026-09-27T15:00:00Z`). **Kalendertage**: `JJJJ-MM-TT` in der Zeitzone des Orts.
- **Zustände als Aufzählung** (`teilweise_bewoelkt`, `ausreichend`), die Übersetzung in Text macht der Adapter.
- **Fehlender Wert** = `null`, nie leerer String oder 0.
- **Listen** sind sortiert (zeitlich aufsteigend oder nach Relevanz – im Schema dokumentiert).

## Dienst „ort“ (Standort) und das Ort-Objekt
Der Dienst `ort` findet Orte
- nach **Name**: `/api/v1/ort?q=Neustadt Sachsen` – eigener Ortsbestand (GeoNames), tolerant wie eine Suchmaschine: jedes Suchwort muss im Namen oder im Umfeld (Bundesland mit Kürzeln wie „Sa.“, Regierungsbezirk, Kreis, PLZ) passen; Umlaute, Füllwörter und Satzzeichen egal, Tippfehler als Rückfall; größere Orte vorn; bis zu 6 Treffer. Passt kein deutscher Ort genau oder nur ein kleiner („Wien“, „Rom“), wird zusätzlich im Ausland gesucht (Open-Meteo Geocoding). `land=DE` schaltet das ab (Vorschläge beim Tippen),
- nach **Postleitzahl** (Deutschland): `/api/v1/ort?q=01844` – eigener Ortsbestand,
- nach **Koordinaten** (Gerätestandort): `/api/v1/ort?lat=51.05&lon=13.74` – nächster Postleitzahl-Punkt im eigenen Bestand (bis 25 km, nur Deutschland; sonst leer mit Hinweis `ausserhalb`).

Der Ortsbestand `services/daten/orte-de.json` (≈ 15.000 Orte, 1,3 MB) wird mit `tools/orte-daten.js` aus den GeoNames-Downloads erzeugt – monatlich und auf Knopfdruck durch die GitHub Action „Daten erneuern“ (`.github/workflows/daten-erneuern.yml`, Erzeuger `tools/daten/orte.js`). Alle Datenbestände laufen über diesen einen Workflow; ein neuer Bestand braucht nur eine neue Datei `tools/daten/<name>.js`. Details: Dienstblatt `../dienste/ort.md`.

Ort-Objekt (Pflicht: `name`, `lat`, `lon`; der Dienst `ort` liefert immer alle Felder, ggf. `null`/leer):

| Feld | Beispiel | Bedeutung |
|---|---|---|
| `name` | `Neustadt in Sachsen` | Ortsname |
| `region` | `Sachsen` | Bundesland bzw. Region |
| `land` | `DE` | Ländercode (ISO 3166-1) |
| `kreis` | `Landkreis Sächsische Schweiz-Osterzgebirge` | Landkreis bzw. kreisfreie Stadt |
| `kreisSchluessel` | `14628` | amtlicher Kreisschlüssel (nur Deutschland) |
| `plz` | `["01844"]` | Postleitzahlen (Liste) |
| `einwohner` | `12460` | Einwohnerzahl, falls bekannt |
| `typ` | `ort` / `stadtteil` | Stadtteile werden nachrangig sortiert |
| `lat`, `lon` | `51.02`, `14.22` | auf 2 Nachkommastellen gerundet |
| `zeitzone` | `Europe/Berlin` | IANA-Zeitzone |

## Eingabe „Ort“ für andere Dienste
Ortsbezogene Dienste akzeptieren
- `ort=<Name oder Postleitzahl>` → wird über den Dienst `ort` aufgelöst (erster Treffer), oder
- `lat`, `lon` (+ optional `name`, `region`, `land`, `zeitzone`) – so ruft die App auf.

Koordinaten werden **auf 2 Nachkommastellen (≈ 1 km) gerundet**: Datenschutz und gemeinsamer Cache.

## Länder
Jeder Dienst gibt im Katalog an, wo er funktioniert: `laender: "alle"` oder eine Liste wie `["DE"]`. Liegt der Ort außerhalb, antwortet der Dienst mit `nicht_unterstuetzt`; Oberflächen können solche Dienste ausblenden. Der Dienst `ort` findet weltweit, sortiert Deutschland aber nach vorn.

## Klassen
| Klasse | Bedeutung |
|---|---|
| `oeffentlich` | ohne Nutzerdaten, CDN-Cache nach TTL, CORS offen (andere Oberflächen dürfen lesen) |
| `privat` | nur mit `DAILY_PRIVATE=1`, nie gecacht, kein CORS (z. B. Kalender, Schlagzeilen) |
| `schluessel` (geplant) | braucht einen Betreiber-Schlüssel, sonst `schluessel_fehlt` |

## Versionen
- **App-Version** (Oberfläche und Server, ein Upload): Nummer `x.y.z` in `package.json` und `src/js/core/version.js` (gleich, Test prüft das). Kleine Korrektur → `z+1`, neue Funktion → `y+1`. `build.js` ergänzt Zeitpunkt und Commit (Vercel) und benennt den Service-Worker-Cache je Upload neu. Anzeige: Fußzeile („v0.6.0“, öffnet „Datenquellen“), unten in den Einstellungen, oben auf der Datenquellen-Seite; der Katalog liefert `daten.app` (Server).
- **Dienst:** `version` = Vertrag (Datenformat, nur bei inkompatibler Änderung), `programmversion` = Stand des Dienstes (`x.y.z`, steigt bei jeder Änderung) mit Liste `aenderungen` (neueste zuerst). Jede Antwort trägt `programm`; Katalog, Dienstblatt und Datenquellen-Seite zeigen beides.
- Regel für Claude: Bei jeder Änderung App-Nummer und betroffene Dienst-Programmversionen erhöhen und `aenderungen` ergänzen.

## Dienstblatt (Transparenz)
Jeder Dienst beschreibt sich selbst im Feld `blatt`: Zweck, Herkunft der Daten, Verarbeitung, jedes Ausgabefeld, Hinweise und Skalierung (Klasse A–D, Grenzen der Quelle, Kosten, Cache, Verhalten bei 10 Mio. Aufrufen/Tag – Rahmen in `skalierung.md`).
Daraus entstehen der Katalog `/api/v1/dienste`, die Dateien `docs/dienste/<id>.md` (`npm run doku`) und die App-Seite „Woher kommen die Daten?“ (Fußzeile → Datenquellen). Ein Test bricht ab, wenn ein Blatt unvollständig ist, ein Ausgabefeld fehlt oder `docs/dienste` veraltet ist.

## Einen Dienst bauen
1. `services/<id>.js` mit `id, version, titel, beschreibung, eingaben, laender, klasse, ttl, quellen, schema, blatt` und `run(eingabe) → { daten, ort?, hinweise?, quellen? }`.
   Die Umwandlung der Quelle als eigene, reine Funktion `umwandeln()` exportieren (testbar ohne Netz).
2. In `services/index.js` eintragen.
3. Beispieldaten der Quelle in `tools/fixtures.js`, Umleitung in `tools/fetch-stub.js`.
4. Tests in `test/dienste.test.js`: Vertrag (Schema), Router, Fehlerfälle. Danach `npm run doku`.
5. Adapter `src/js/adapter/<id>.js` mit mindestens `kachel(env)`; Kachel-Anbindung in `src/js/providers/`.

## Bausteine
| Datei | Zweck |
|---|---|
| `services/_lib/rahmen.js` | Rahmen daily/1, Fehlerklasse, Zeit- und Rundungshilfen |
| `services/_lib/schema.js` | Schema-Prüfer (Teilmenge von JSON Schema) und Bausteine `S.*`, Rahmen-Schema |
| `services/_lib/ort.js` | Ort-Eingabe auflösen und runden |
| `services/_lib/orte.js` | eigener Ortsbestand: Name, Postleitzahl, Umkehrsuche |
| `services/_lib/blatt.js` | Dienstblatt prüfen und als Markdown ausgeben |
| `services/_lib/http.js` | `getJson`, `postJson`, `send` (Cache-Header), Betriebsart |
| `services/index.js` | Verzeichnis, `ausfuehren()`, `katalog()` |
| `api/v1/[dienst].js` | HTTP-Einstieg |
| `src/js/dienste/client.js` | Abruf im Browser, Zwischenspeicher bis `gueltigBis`, Fehler mit Code |
| `src/js/adapter/*.js` | Darstellung je Dienst (ohne DOM, testbar) |

## Stand der Umstellung
| Dienst | Status |
|---|---|
| `ort` | ✅ daily/1 – eigener Ortsbestand (Name, Postleitzahl, Gerätestandort), Ausland über Open-Meteo; Einstellungen nutzen ihn |
| `wetter` | ✅ daily/1 – Referenz; Kachel über Adapter |
| `regen` | ✅ daily/1 – DWD-Radar über Bright Sky; erscheint in der Wetterkachel (Hinweis + Reiter „Radar“) |
| `wetterhinweise` | ✅ daily/1 – amtliche DWD-Warnungen über Bright Sky; ersetzt die Kachel „Warnungen“, erscheint in der Wetterkachel (Abzeichen, Hinweis, Reiter „Hinweise“) nur, wenn es etwas gibt |
| `feiertage`, `himmel` | ✅ daily/1 – Kachel „Kalender“ (ersetzt „Feiertage & Ferien“ und „Himmel“): Feiertage, Ferien (OpenHolidays), Brückentage, Zeitumstellung, KW, Aktionstage; Mond, Finsternisse, Sternschnuppen, Jahreszeiten (Astronomy Engine) |
| `namenstage` | ✅ daily/1 – eigener Bestand aus Wikidata (CC0), monatlich per Action; in der Kachel „Kalender“ (Zeile, Reiter „Namenstage“, Frag DAILY „Wann hat Josef Namenstag?“) |
| Tanken, Abfahrten, Sport, Geld, Wissen, Tagesinhalte | ⏳ noch alte Einzelfunktionen bzw. im Browser berechnet |
| Kalender, Schlagzeilen (privat) | ⏳ |

Nach der Umstellung aller Dienste entfallen die alten `api/*.js`-Funktionen.
