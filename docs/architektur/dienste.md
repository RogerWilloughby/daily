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
POST /api/v1/<privater dienst>  {JSON}   → private Dienste auch per POST (z. B. termine mit den iCal-Links im Körper; nie in der Adresse)
```
**Grundsatz (02.10.2026):** Jeder Dienst ist einzeln abrufbar und verhält sich im Betrieb wie allein – es gibt **kein Paket** mehr (bis App 0.38.0: `/api/v1/paket`). **Die Adresse ist der Cache-Schlüssel:** Sie enthält nur, wovon die Antwort abhängt (Ortsdienste nur `lat`/`lon` mit höchstens 2 Nachkommastellen, `feiertage` nur `bundesland`, Dienste ohne Eingaben gar nichts); Unbekanntes wird abgelehnt (seit App 0.40.0). Liste je Dienst: `../konzept/entscheidungen.md`, Abschnitt 14.
Eine einzige Vercel-Funktion (`api/v1/[dienst].js`) bedient alle Dienste (Grenze Hobby-Tarif: 12 Funktionen).

## Austauschformat daily/1 (Rahmen)
Jede Antwort – auch jeder Fehler – hat diese Form:

```json
{
  "format": "daily/1",
  "dienst": "wetter",
  "version": 1,
  "ort": { "name": null, "region": null, "land": null, "lat": 52.52, "lon": 13.41, "zeitzone": "Europe/Berlin" },
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
| `nicht_berechtigt` | 401 | privater Dienst ohne oder mit falschem Kennwort |
| `nicht_unterstuetzt` | 422 | Dienst deckt das Land des Orts nicht ab (siehe `laender` im Katalog) |
| `schluessel_fehlt` | 503 | Betreiber-Schlüssel (z. B. Tankerkönig) nicht eingerichtet |
| `quelle_fehler` | 502 | externe Quelle nicht erreichbar oder fehlerhaft |
| `intern` | 500 | Programmfehler |

## Regeln für `daten`
- **Reine Daten**: Zahlen, Codes, Aufzählungswerte – keine Sätze („Regen möglich gegen 17 Uhr“ baut der Adapter).
- **Feldnamen** deutsch, camelCase, nur ASCII (`gefuehltC`, `graeser`).
- **Einheit im Feldnamen**: `tempC`, `windKmh`, `niederschlagMm`, `regenProzent`, `preisEur`, `entfernungKm`.
- **Zeitpunkte**: ISO 8601 in UTC mit `Z` (`2026-09-27T15:00:00Z`). **Kalendertage**: `JJJJ-MM-TT` in der Zeitzone des Orts.
- **Takt** (`takt`, Sekunden): Antworten gelten für alle bis zum nächsten Taktende (`gueltigBis`, z. B. :00/:30). Tagestakt (86400) endet um **Mitternacht deutscher Zeit** (seit 0.46.2, `rahmen.js` → `mitternachtNach`).
- **Zustände als Aufzählung** (`teilweise_bewoelkt`, `ausreichend`), die Übersetzung in Text macht der Adapter.
- **Fehlender Wert** = `null`, nie leerer String oder 0.
- **Listen** sind sortiert (zeitlich aufsteigend oder nach Relevanz – im Schema dokumentiert).

## Dienst „ort“ (Standort) und das Ort-Objekt
Der Dienst `ort` findet Orte
- nach **Name**: `/api/v1/ort?q=Neustadt Sachsen` – eigener Ortsbestand (GeoNames), tolerant wie eine Suchmaschine: jedes Suchwort muss im Namen oder im Umfeld (Bundesland mit Kürzeln wie „Sa.“, Regierungsbezirk, Kreis, PLZ) passen; Umlaute, Füllwörter und Satzzeichen egal, Tippfehler als Rückfall; größere Orte vorn; bis zu 6 Treffer. Passt kein deutscher Ort genau oder nur ein kleiner („Wien“, „Rom“), wird zusätzlich im Ausland gesucht (Open-Meteo Geocoding). `land=DE` schaltet das ab (Vorschläge beim Tippen),
- nach **Postleitzahl** (Deutschland): `/api/v1/ort?q=01844` – eigener Ortsbestand,
- nach **Koordinaten** (Gerätestandort): `/api/v1/ort?lat=51.05&lon=13.74` – nächster Postleitzahl-Punkt im eigenen Bestand (bis 25 km, nur Deutschland; sonst leer mit Hinweis `ausserhalb`).

Der Ortsbestand `services/daten/orte-de.json` (≈ 15.000 Orte, 1,3 MB) wird mit `tools/orte-daten.js` aus den GeoNames-Downloads erzeugt und liegt als **feste Datei** im Repo – keine Automatik (Orte ändern sich kaum); bei Bedarf einmalig neu erzeugen. Grundsatz seit 27.09.2026: selten geänderte Daten (Orte, Namenstage) sind feste Dateien, keine Workflows. Details: Dienstblatt `../dienste/ort.md`.

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
Ortsbezogene Dienste (`wetter`, `regen`, `wetterhinweise`, `himmel`, `tanken`) nehmen **nur Koordinaten**: `lat`, `lon` mit **höchstens 2 Nachkommastellen (≈ 1 km)** in der kurzen Schreibweise (`51.05`, `13.7` – nicht `51.050`, nicht `51.0512`). Alles andere wird abgelehnt (seit App 0.40.0, `entscheidungen.md` Abschnitt 14): kein `ort=<Name>` (Ortsnamen löst nur der Dienst `ort` auf), kein `name`, `region`, `land`, `zeitzone`. Grund: Die Adresse ist der Cache-Schlüssel – Berlin ergibt genau ein Fach.

Die Antwort enthält im Rahmen `ort` die gerundeten Koordinaten (und bei `wetter` die Zeitzone aus der Quelle), **keinen Ortsnamen**: Den kennt die Oberfläche, sie setzt Name und Land des gewählten Orts selbst ein (`src/js/dienste/client.js → mitOrt`). So bleibt jeder Dienst unabhängig vom Ortsbestand, und angezeigt wird immer genau der gewählte Ort, auch im Ausland. Dienste mit Quellen nur in Deutschland (z. B. `tanken`) erkennen das Ausland an einem groben Rahmen um Deutschland (`_lib/ort.js → inDeutschland`).

## Länder
Jeder Dienst gibt im Katalog an, wo er funktioniert: `laender: "alle"` oder eine Liste wie `["DE"]`. Liegt der Ort außerhalb, antwortet der Dienst mit `nicht_unterstuetzt`; Oberflächen können solche Dienste ausblenden. Der Dienst `ort` findet weltweit, sortiert Deutschland aber nach vorn.

## Klassen
| Klasse | Bedeutung |
|---|---|
| `oeffentlich` | ohne Nutzerdaten, CDN-Cache nach TTL, CORS offen (andere Oberflächen dürfen lesen) |
| `privat` | nur mit `DAILY_PRIVATE=1` **und Kennwort** (Kopfzeile `X-Daily-Kennwort` = Vercel-Variable `DAILY_PRIVAT_KENNWORT`, sonst `nicht_berechtigt` 401), nie gecacht, kein CORS (z. B. Kalender, Schlagzeilen) |
| `schluessel` (geplant) | braucht einen Betreiber-Schlüssel, sonst `schluessel_fehlt` |

## Versionen
- **App-Version** (Oberfläche und Server, ein Upload): Nummer `x.y.z` in `package.json` und `src/js/core/version.js` (gleich, Test prüft das). Kleine Korrektur → `z+1`, neue Funktion → `y+1`. `build.js` ergänzt Zeitpunkt und Commit (Vercel) und benennt den Service-Worker-Cache je Upload neu. Anzeige: Fußzeile („v0.6.0“, öffnet „Datenquellen“), unten in den Einstellungen, oben auf der Datenquellen-Seite; der Katalog liefert `daten.app` (Server).
- **Dienst:** `version` = Vertrag (Datenformat, nur bei inkompatibler Änderung), `programmversion` = Stand des Dienstes (`x.y.z`, steigt bei jeder Änderung) mit Liste `aenderungen` (neueste zuerst). Jede Antwort trägt `programm`; Katalog, Dienstblatt und Datenquellen-Seite zeigen beides.
- **Vertragsversion im Browser (seit 0.46.0, Review M6):** `src/js/dienste/vertraege.js` nennt je Dienst die Vertragsversion, die die Oberfläche versteht. `client.js` prüft jede Antwort (Dienstname und `version`); passt sie nicht → `antwort_ungueltig` mit Grund, die Kachel zeigt den letzten passenden Stand („Stand …“) oder einen Fehler; gespeicherte Antworten in fremdem Vertrag werden nicht angezeigt. **Steigt der Vertrag eines Dienstes:** Adapter anpassen und die Zahl in `vertraege.js` erhöhen – sonst ist ein Test rot (und Vercel baut nicht). Neuer Dienst: Eintrag in `vertraege.js`.
- **Schema streng (seit 0.46.0):** Tests (`gueltig`) und Testserver prüfen jede Antwort mit `pruefeStreng` – auch Felder, die im Schema fehlen. Der Testserver meldet Verstöße im Log („SCHEMA-FEHLER …“) und in der Kopfzeile `X-Daily-Schema`.
- Regel für Claude: Bei jeder Änderung App-Nummer und betroffene Dienst-Programmversionen erhöhen und `aenderungen` ergänzen.

## Dienstblatt (Transparenz)
Jeder Dienst beschreibt sich selbst im Feld `blatt`: Zweck, Herkunft der Daten, Verarbeitung, jedes Ausgabefeld, Hinweise und Skalierung (Klasse A–D, Grenzen der Quelle, Kosten, Cache, Verhalten bei 10 Mio. Aufrufen/Tag – Rahmen in `skalierung.md`).
Daraus entstehen der Katalog `/api/v1/dienste`, die Dateien `docs/dienste/<id>.md` (`npm run doku`) und die App-Seite „Woher kommen die Daten?“ (Fußzeile → Datenquellen). Ein Test bricht ab, wenn ein Blatt unvollständig ist, ein Ausgabefeld fehlt oder `docs/dienste` veraltet ist.

## Einen Dienst bauen
0. **Datenhaltung prüfen (vor dem Plan):** Kommt der Dienst mit festen Dateien im Repo (`services/daten/`), Rechnen oder Live-Abruf + CDN-Zwischenspeicher aus? Wenn nicht (wachsende Daten, Nutzerdaten über Geräte), erst mit Roger klären – keine Datenbank ohne Entscheidung (`../konzept/entscheidungen.md`, Abschnitt 12).
1. `services/<id>.js` mit `id, version, titel, beschreibung, eingaben, parameter, laender, klasse, ttl, quellen, schema, blatt` und `run(eingabe) → { daten, ort?, hinweise?, quellen? }`.
   `parameter` = erlaubte Angaben mit Prüfung (`services/_lib/parameter.js`: `P.lat`, `P.lon`, `P.datum`, `P.wahl([...])`, `P.text(...)`); dieselben Namen wie in `eingaben` (ein Test prüft das). `ausfuehren` lehnt alles andere ab (400) und bildet den Instanz-Schlüssel nur aus diesen Angaben.
   **Eingaben = Cache-Schlüssel:** nur aufnehmen, wovon die Antwort wirklich abhängt, in genau einer Schreibweise (z. B. Bundesland statt Ort, wenn nur das Bundesland zählt; keine Anzeigenamen).
   Die Umwandlung der Quelle als eigene, reine Funktion `umwandeln()` exportieren (testbar ohne Netz).
2. In `services/index.js` → `LADER` eintragen (`id: () => require('./id')`, wörtlich – Dienste werden erst beim ersten Aufruf geladen, seit 0.46.1; ein Test prüft, dass jede Datei eingetragen ist), dazu die Vertragsversion in `src/js/dienste/vertraege.js`.
3. Beispieldaten der Quelle in `tools/fixtures.js`, Umleitung in `tools/fetch-stub.js`.
4. Tests in `test/dienste.test.js`: Vertrag (Schema), Router, Fehlerfälle. Danach `npm run doku`.
5. Adapter `src/js/adapter/<id>.js` mit mindestens `kachel(env)`; Kachel-Anbindung in `src/js/providers/`.

## Bausteine
| Datei | Zweck |
|---|---|
| `services/_lib/rahmen.js` | Rahmen daily/1, Fehlerklasse, Zeit- und Rundungshilfen |
| `services/_lib/schema.js` | Schema-Prüfer (Teilmenge von JSON Schema; `pruefeStreng` meldet auch unbekannte Felder) und Bausteine `S.*`, Rahmen-Schema |
| `services/_lib/ort.js` | Ort-Eingabe (nur Koordinaten) und grober Deutschland-Rahmen |
| `services/_lib/parameter.js` | erlaubte Angaben je Dienst prüfen (Adresse = Cache-Schlüssel), Bausteine `P.*` |
| `services/_lib/orte.js` | eigener Ortsbestand: Name, Postleitzahl, Umkehrsuche |
| `services/_lib/radolan.js` | Radarraster des DWD ↔ Koordinaten (für `regen`, Karte) |
| `api/icon.js` | Seitensymbole für „Meine Seiten“, `GET /api/icon?s=<id>` → Bild; nur Seiten aus `src/content/seiten.json`, direkt von der Seite (apple-touch-icon, HTML, favicon), CDN 30 Tage |
| `api/karte.js` | Kartenkacheln basemap.de (BKG) für die Radarkarte, `GET /api/karte?z=&x=&y=` → PNG; kein daily/1-Dienst, nur Zoom 8–11 über Deutschland, CDN 30 Tage |
| `services/_lib/blatt.js` | Dienstblatt prüfen und als Markdown ausgeben |
| `services/_lib/http.js` | `getJson`, `postJson`, `send` (Cache-Header: `s-maxage` bis `gueltigBis`, `stale-while-revalidate`, `stale-if-error=3600`), Betriebsart |
| `services/_lib/drossel.js` | Bremse für Quellen mit Schlüssel (z. B. Tankerkönig 30 Abrufe/Minute je Instanz) |
| `services/index.js` | Verzeichnis, `ausfuehren()`, `katalog()` |
| `api/v1/[dienst].js` | HTTP-Einstieg |
| `src/js/dienste/client.js` | Abruf im Browser, Zwischenspeicher bis `gueltigBis`, Fehler mit Code |
| `src/js/adapter/*.js` | Darstellung je Dienst (ohne DOM, testbar) |

## Aufbau der Oberfläche: wo liegt was
Seit App 0.47.0 die Oberfläche „Abreißblock“ (Phase 1b); seit 0.47.2 ohne das alte Kachelraster; seit 0.49.0 drei Ebenen Bereich → Rubrik → Thema (Bereiche Heute · Entdecken · Wetter · Kalender · Mehr, Gliederung `../konzept/themen.md`).
Die Oberfläche weiß nichts über einzelne Bereiche – besondere Darstellung hängt sich über Ansichten ein (Test „Aufbau“ in `test/daily.test.js` wacht darüber).
Info-Dienste ohne Bereich (Tanken, Fußball, Autobahn, Finanzen, Kurse, Schlagzeilen, Termine, Abfahrten) laufen nur noch auf dem Server (headless, nur pflegen).

| Datei | Zweck |
|---|---|
| `src/js/core/oberflaeche.js` | Gerüst: drei Ebenen Bereich → Rubrik (`untertabsVon`) → Thema (`teile`, Zeile `.ab-themen`, Ereignis `daily:thema`), Adresse `#bereich/rubrik/thema` (`adresseLesen`), `set(id, patch)` für die Anbieter, nur ganze Zeilen |
| `src/js/core/mini-reiter.js` | Listen (`listeHtml`, Zeile mit `href` oder `aktion` → `data-aktion`), Zeilen ausblenden, die nicht passen (`krZeilen`) |
| `src/js/core/betrieb.js` | Betriebsart (öffentlich/privat) und `GENUTZTE_DIENSTE` – die Dienste der Oberfläche (für „Woher kommen die Daten?“ und den Speicher im Browser) |
| `src/js/core/store.js` | Speicher im Browser: Einstellungen, Orte, Meine Seiten, Gemerktes; einmaliges Aufräumen der Kachel-Daten (`aufraeumen`, 0.47.3) |
| `src/js/core/einstellungen.js` | Formular je Bereich (`kachelEinstellungen`, `formular`, `binden`) – erscheint im Einstellungsfenster (`ui/dialogs.js`) |
| `src/js/core/ansichten.js` | Anmeldung: `ansicht(id, { spalte, zurueck })` für einen Bereich, `erweiterung({ nachZeichnen, groesse, zeiger })` für alle |
| `src/js/ansichten/mini-diagramm.js` | allgemeine Diagramm-Bedienung: Dichte je Platz (`miniDichte`), Überfahren der Spalten |
| `src/js/ansichten/wetter.js` | Wetter: Zeitpunkt-Block unter „Jetzt“ („Jetzt“ / überfahrene Stunde oder Tag); HTML aus `adapter/wetter.js` (`zpHtml`, `jetztHtml`) |
| `src/js/ansichten/radar.js` | Radarkarte (Untertab „Radar“): Bilder laufen lassen, Zeitleiste (Start/Pause, Sprung) |
| `src/js/providers/heute.js` | Tagesinhalte für „Heute“ (mit Blättern), „Entdecken“ und „Mehr → Alltag“ (immer heute, Gemerktes mit „vom …“): Dienste `tagesinhalt` und `andiesemtag` je Tag, Lösung, Rezeptseite, Merken (→ Mehr · Gemerkt); Zuordnung in `adapter/tagesinhalt.js` (`ortVon`) |
| `src/js/providers/weather.js`, `kalender.js`, `links.js`, `tools.js` | Wetter, Kalender (darin `himmelAnbieter` für Wetter → Himmel), Meine Seiten, Tools (privat) |
| `src/js/adapter/diagramm.js` | Wetter-Diagramme als HTML/SVG-Text und gemeinsame Bausteine (`skala`, `pfad`, `pfadRund`, `MINI_WAHL` – Zeiträume für die Themen unter Wetter → Jetzt) |
| `src/app.css` | allgemeine Styles, Design-Tokens, Dialoge, Listen im Feld |
| `src/css/abreissblock.css` | Gestaltung Variante A: Farben hell/dunkel, Gerüst Handy/Rechner, Blatt, Untertabs, Inhalte |
| `src/css/diagramm.css` | gemeinsame Diagramm-Styles `.wd-*` und Farben `--wd-*` (Wetter, Kalender) |
| `src/css/wetter.css` | nur Wetter: Zeitpunkt-Block, Radar, Hinweise, Sonnenzahlen |
| `src/css/seiten.css`, `lokal.css` | Meine Seiten (Symbolraster), Tools (Beschreibung, Knopf) |

**Laden (seit 0.48.0):** Jeder Anbieter hat einen `bereich` (heute · entdecken · wetter · kalender · mehr, eine Liste davon oder `immer`); `main.js` startet nur die Anbieter des sichtbaren Bereichs (`faelligeAnbieter`, Ereignis `daily:bereich`) und frischt nur diese auf. `src/sw.js` hält alles außer `/api` je Version im Speicher; `main.js` meldet ihn an, prüft bei jedem Öffnen auf eine neue Version und lädt nach dem Wechsel einmal neu.

Neuer Bereich oder Untertab mit eigener Darstellung: Datei unter `src/js/ansichten/`, vom Anbieter importiert; eigene Styles unter `src/css/`, in `index.html` und `sw.js` eingetragen.

## Stand der Umstellung
| Dienst | Status |
|---|---|
| `ort` | ✅ daily/1 – eigener Ortsbestand (Name, Postleitzahl, Gerätestandort), Ausland über Open-Meteo; Einstellungen nutzen ihn |
| `wetter` | ✅ daily/1 – Referenz; Kachel über Adapter |
| `regen` | ✅ daily/1 – DWD-Radar über Bright Sky; erscheint in der Wetterkachel (Hinweis + Reiter „Radar“) |
| `wetterhinweise` | ✅ daily/1 – amtliche DWD-Warnungen über Bright Sky; ersetzt die Kachel „Warnungen“, erscheint in der Wetterkachel (Abzeichen, Hinweis, Reiter „Hinweise“) nur, wenn es etwas gibt |
| `feiertage`, `himmel` | ✅ daily/1 – Kachel „Kalender“ (ersetzt „Feiertage & Ferien“ und „Himmel“): Feiertage, Ferien (OpenHolidays), Brückentage, Zeitumstellung, KW, Aktionstage; Mond, Finsternisse, Sternschnuppen, Jahreszeiten (Astronomy Engine); seit 0.49.0 erscheint `himmel` unter Wetter → Himmel |
| `namenstage` | ✅ daily/1 – feste, gepflegte Liste nach dem kirchlichen Kalender (`services/daten/namenstage.json`); in der Kachel „Kalender“ (Zeile, Reiter „Namenstage“, Frag DAILY „Wann hat Josef Namenstag?“) |
| `termine` | ✅ daily/1, **nur privat** – eigene Termine aus iCal (14 Tage), Links nur per POST, nie zwischengespeichert; in der Kachel „Kalender“ (Kennzahl „14:00 Zahnarzt“, Reiter „Termine“) |
| `finanzen` | ✅ daily/1 – EZB: Wechselkurse (90 Tage), Leitzinsen, Inflation; Kachel „Finanzen“ |
| `tanken` | ✅ daily/1 – Tankerkönig (MTS-K): E5, E10, Diesel im Umkreis 2/5/10 km; Kachel „Verkehr“, Ansicht „Tanken“ |
| `tagesinhalt` | ✅ daily/1 – Tagesinhalte aus der festen Datei, je Tag (Verlauf), nie Zukunft; Themen-Kacheln Unterhaltung, Wissen, Alltag und Spartipp in Finanzen |
| `andiesemtag` | ✅ daily/1 – Wikipedia „An diesem Tag“ je Datum (Verlauf), ersetzt `api/onthisday.js`; Kachel „Wissen“, Reiter „An diesem Tag“ |
| `autobahn` | ✅ daily/1 – Autobahn-API: Staus, Sperrungen, Baustellen je Autobahn (bis 5); Kachel „Verkehr“, Ansicht „Arbeitsweg“ – Start/Ziel nur im Browser, Filter auf den Weg im Adapter |
| `kurse` | ✅ daily/1, **nur privat** – Yahoo (DAX, S&P 500, MSCI World, Bitcoin, Ethereum, Gold); Kachel „Finanzen“, Reiter „Märkte“ |
| `fussball` | ✅ daily/1 – OpenLigaDB je Liga (Tabelle, drei Spieltage), ersetzt `api/sport.js`; Kachel „Sport“ (Verein · Tabelle · Spieltag), Verein sucht der Browser |
| Abfahrten | ⏳ noch alte Einzelfunktion (`api/transit.js`) |
| `schlagzeilen` | ✅ daily/1, **nur privat** – Tagesschau, MDR Sachsen, heise (RSS/Atom), ersetzt `api/headlines.js`; Kachel „Schlagzeilen“ (Neueste · je Quelle) |

Nach der Umstellung aller Dienste entfallen die alten `api/*.js`-Funktionen.
