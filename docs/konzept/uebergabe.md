# DAILY – Übergabe: aktueller Arbeitsstand

Stand 02.10.2026 (App 0.42.0). Für neue Chats: hier steht, woran gerade gearbeitet wird und wie es weitergeht. Verbindliche Entscheidungen stehen in `entscheidungen.md`, die Architektur in `../architektur/dienste.md`.

## Vorgehen (Rogers Vorgaben)
- **Rückfragen IMMER EINZELN (Rogers Vorgabe vom 01.10.2026):** immer nur eine Frage auf einmal stellen, auf die Antwort warten, dann die nächste – nie mehrere Fragen gesammelt (auch nicht nummeriert am Ende eines Plans). Steht auch im Projekt-Wegweiser `claude/LIES-MICH-ZUERST.md`.
- **Erst Plan, dann Umsetzung (Rogers Vorgabe vom 27.09.2026):** Vor jeder Umsetzung und vor jedem Schreiben ins Repo einen kurzen Plan vorlegen – was und warum, welche Dateien (neu/geändert/gelöscht), was Roger danach tun muss, was offen/unsicher ist – und auf Rogers OK warten. Nicht einfach loslegen.
- **Der Reihe nach, einzeln:** ein Punkt pro Schritt, Entscheidungen per Rückfrage. Erst testen, dann zum nächsten Dienst. Nicht vorgreifen („Warum beschäftigen wir uns schon mit dem Wetter, wenn wir doch noch am Standort arbeiten?“).
- **Headless:** Dienste liefern reine Daten im Format daily/1, Adapter und Oberflächen stellen dar. Jeder Dienst wird einzeln gebaut und in der Kachelansicht getestet.
- **Transparenz:** Jeder Dienst hat ein Dienstblatt (Herkunft, Zweck, Eingabe, Ausgabe, Verarbeitung, Skalierung) – siehe `../dienste/`.
- **Skalierung:** Für jeden Dienst die Frage „10 Mio. Aufrufe/Tag?“ – Rahmen in `../architektur/skalierung.md`.
- **Qualität:** „Die Ortseingabe muss 100 % perfekt sein“ – Maßstab ist Google. Jeder gemeldete Fehlfall wird ein Testfall in `test/dienste.test.js`.
- **Strategie öffentlich:** keine Nutzerdaten außer dem Ort, keine Nachrichten. Kalender und Schlagzeilen nur privat. Mail und Pakete gestrichen.
- **Handy pausiert (29.09.2026):** Darstellung auf dem Handy ruht, bis Roger das Thema wieder aufnimmt – Dienste und Darstellung erst exemplarisch am PC.
- **Bedienung (29.09.2026):** Mini-Reiter in der kleinen Kachel statt Aufklappen (`entscheidungen.md`, Abschnitt 13; Vorlage `vorlage-mini-reiter.md`).
- **Datenhaltung (29.09.2026):** keine Datenbank – feste Daten als Dateien im Repo, Regeln rechnen, Wechselndes live + CDN. Vor jedem neuen Dienst prüfen, dass er damit auskommt (`entscheidungen.md`, Abschnitt 12).
- Roger liefert später weitere Dienst-Ideen.

## Arbeitsablauf und Stolpersteine
- **Keine Screenshots an Roger schicken (29.09.2026):** kosten nur Token – Roger prüft selbst im Browser. Eigene Prüfung per Tests.
- **Versionen (seit 27.09.2026, App 0.6.0):** bei jeder Änderung App-Nummer (`package.json` + `src/js/core/version.js`) und betroffene Dienst-`programmversion` + `aenderungen` erhöhen. Details `../architektur/dienste.md` → Versionen.
- Hochladen nur über `hochladen.cmd` (siehe Wegweiser im Projekt). Claude schreibt Dateien ins lokale Repo und legt `.commit-msg.txt` an; lokal nie git-Befehle.
- `hochladen.cmd` lädt seit 27.09. auch liegengebliebene Commits nach (wenn ein Push fehlschlug und nichts Neues zu committen ist).
- **Keine Workflows mehr (seit 27.09., Rogers Entscheidung):** Selten geänderte Daten (Ortsbestand, Namenstage) sind feste Dateien in `services/daten/`. Keine GitHub Actions, keine Erzeuger-Skripte, nichts von Hand zu starten. `.github/workflows` ist leer (für Claude ohnehin gesperrt). Rogers Git-Anmeldung hat seit 27.09. das Recht `workflow` (`gh auth`), falls doch einmal nötig.
- Warum Dateien statt Datenbank: kleine, selten geänderte Daten liegen im Speicher der Funktion (< 1 ms); eine Datenbank kostete je Anfrage 5–20 ms und bräuchte trotzdem einen Abrufjob. Datenbank erst für große/oft geänderte Daten (zentrales Wetter/Radar).
- Netz: Cloud-Container und Desktop-VM erreichen nur GitHub, npm und PyPI – nicht Open-Meteo, GeoNames, DWD, destatis. Neu erzeugte Datenbestände (selten) daher auf einem Rechner mit Netz; im Alltag sind es feste Dateien.
- **Vercel baut nicht nach dem Hochladen (28.09.):** Der Push kam auf GitHub an, Vercel hat ihn verpasst. „Redeploy“ auf einem alten Eintrag baut nur **diesen alten Stand** neu – stattdessen „Create Deployment“ mit `main` oder einfach neu hochladen (ein neuer Push löst Vercel aus).
- **Privater Betrieb:** Vercel-Variable `DAILY_PRIVATE=1` (Production) – gesetzt am 28.09. Ohne sie läuft die Seite öffentlich: keine Termine, keine Schlagzeilen, kein Feld für Kalender-Links. **Seit 0.42.0 zusätzlich Kennwort:** Vercel-Variable `DAILY_PRIVAT_KENNWORT`, in DAILY unter Einstellungen → „Privater Betrieb“ eintragen (Testserver: `test`). Kennwort nie in den Chat. Environment Variables liegen in der Vercel-Oberfläche in der **Seitenleiste des Projekts** (nicht unter Settings), direkt: https://vercel.com/rogerwilloughbys-projects/daily/settings/environment-variables. Nach dem Ändern einer Variable: Redeploy des obersten (aktuellen) Eintrags.
- Roger arbeitet unter Windows meist in **PowerShell** (nicht cmd): Befehle immer mit vorherigem `cd` in den Projektordner – oder besser eine `.cmd`-Datei zum Doppelklicken.
- Tests in der Desktop-VM: dort fehlt `node_modules`, `npm test` scheitert an `node-ical`; `node --test test/dienste.test.js` läuft. Vollständig läuft `npm test` im Cloud-Container.
- **Arbeitskopie in der Desktop-VM (29.09.2026):** Claude arbeitet in `public/arbeit/` (per .gitignore ausgeschlossen), dort `npm ci` → `npm test` läuft vollständig. Der Cloud-Container erreicht verkehr.autobahn.de nicht. `npm run build` löscht `public/` – im verbundenen Ordner ist Löschen gesperrt, daher Build und Mock-Server in einer Kopie außerhalb (`$HOME/w`). Playwright in der VM: `playwright-core` + `@sparticuz/chromium` von npm (der Playwright-Download ist gesperrt), Start mit `--no-proxy-server`, ohne `--single-process`. Hintergrundprozesse enden mit jedem Aufruf – Mock-Server und Messung daher im selben Aufruf. `public/` kann Roger jederzeit löschen.

## Stand der Dienste
Oberfläche: Standardbelegung = nur überarbeitete Kacheln (`fertig: true` in `src/js/core/tiles.js`) – **Wetter**, **Kalender**, **Verkehr**, **Finanzen**, **Tools**, Meine Seiten, Mein Daily, Deine Nutzung; übrige Felder „Freier Platz“. Seit 0.16.0 wählt man die Kacheln in Einstellungen → „Kacheln“ (Aktiv/Verfügbar, Doppelklick, Ziehen); alte Kacheln stehen dort als „Vorschau“. Einstellungen einer Kachel: Zahnrad-Reiter in der Kachel (Wetter, Kalender, Verkehr, Finanzen, Sport). Details `entscheidungen.md` → 3a.

| Dienst | Kachel | Stand |
|---|---|---|
| `ort` | Leiste (Ort-Auswahl) | ✅ getestet. Eigener Ortsbestand aus GeoNames (feste Datei, ≈ 14.700 Orte), Suche wie eine Suchmaschine, Vorschläge beim Tippen, Ausland über Open-Meteo, Gerätestandort; mehrere Orte (bis 10) in der Auswahlbox. |
| `wetter` | Wetter | ✅ getestet. Open-Meteo, 15 Tage (ab Tag 8 Trend), Zusatzwerte, Takt :00/:30, Diagramme, Reiter. |
| `regen` | Wetter | ✅ getestet. DWD-Radar über Bright Sky, Reiter „Radar“, „Regen in X Min.“. 🆕 0.29.0 (Dienst 1.1.0): Reiter „Radar“ = Werte · Karte in voller Höhe auf basemap.de · Verlauf; ≈ 100 × 100 km, −1 bis +2 Std., Zeitleiste – auf Vercel zu prüfen (Kartenbild, Lage des Radars). |
| `wetterhinweise` | Wetter | ✅ getestet (0.11.1). Amtliche DWD-Warnungen, Abzeichen und Hinweis nur bei Warnung, Reiter „Hinweise“ immer. |
| `feiertage` | Kalender | ✅ getestet (0.12.0). Feiertage, Schulferien (OpenHolidays), Brückentage, Zeitumstellung, KW, Aktionstage. Seit 2.0.0 (App 0.39.0) nur `bundesland=SN` – eine Antwort je Bundesland. |
| `himmel` | Kalender | ✅ getestet (0.12.0). Mond, Supermond, Sternschnuppen, Finsternisse am Ort, Jahreszeiten (Astronomy Engine). |
| `namenstage` | Kalender | ✅ getestet (0.14.0). Feste Liste nach dem kirchlichen Kalender – Korrekturen direkt in `services/daten/namenstage.json`. |
| `termine` | Kalender (nur privat) | ✅ getestet (0.15.0). Eigene Termine aus iCal, 14 Tage, Links per POST, nie zwischengespeichert. |
| `finanzen` | Finanzen | 🆕 0.22.0, auf Vercel zu testen. EZB: Wechselkurse (90 Tage), Leitzinsen, Inflation; für alle gleich, Takt 1 Std. Adressen der EZB-Datenschnittstelle (Leitzinsen, Inflation) nur nach Dokumentation gebaut – bei Fehlern zuerst dort prüfen. |
| `kurse` | Finanzen, Reiter „Märkte“ (nur privat) | 🆕 0.22.0. Yahoo (vorher `api/markets.js`), DAX, S&P 500, MSCI World, Bitcoin, Ethereum, Gold. |
| `tagesinhalt` | Unterhaltung, Wissen, Alltag, Finanzen (Spartipp) | 🆕 0.34.0. Alle Tagesinhalte eines Tags aus `services/daten/daily.json`, Verlauf bis zum ersten Tag, nie Zukunft; Kachel „Unterhaltung“ mit Blättern, Favoriten, „+ Aufgabe“; seit 0.35.0 auch „Wissen“, seit 0.36.0 „Alltag“ und der Spartipp. |
| `andiesemtag` | Wissen, Reiter „An diesem Tag“ | 🆕 0.35.0, auf Vercel zu testen (kein Schlüssel). Wikipedia „An diesem Tag“ je Datum (Verlauf), ersetzt `api/onthisday.js`. |
| `autobahn` | Verkehr, Ansicht „Arbeitsweg“ | 🆕 0.28.0, auf Vercel zu testen (kein Schlüssel nötig). Autobahn-API: Staus, Sperrungen, Baustellen der gewählten Autobahnen (bis 5), Takt 5 min; Start/Ziel nur im Browser, Filter auf den Weg im Browser (Korridor ≥ 10 km bzw. ¼ der Luftlinie). |
| `tanken` | Verkehr, Reiter „Tanken“ | ✅ live getestet 30.09.2026 (Vercel-Variable `TANKERKOENIG_API_KEY` gesetzt). Alle Sorten mit einem Abruf, Umkreis 2/5/10 km, Takt 5 min. |
| übrige | – | noch alte Schnittstelle (`api/*.js`): Abfahrten (in der Kachel „Verkehr“, `api/transit.js`), ausgeblendet: Sport (Fußball), Schlagzeilen (privat). Nach dem Umzug in `tiles.js` `fertig: true` setzen. |

App-Seite „Woher kommen die Daten?“ (Fußzeile → Datenquellen) zeigt die Dienstblätter aus dem Katalog `/api/v1/dienste`.

## Wetter – Entscheidungen vom 27.09.2026
1. **Quelle Open-Meteo** (nicht DWD MOSMIX), solange DAILY nicht kommerziell ist (keine Werbung, kein Abo). Grund: am wenigsten eigener Aufwand, mehr Daten (15 Tage, UV, Luft, Pollen). Verworfen: Abruf direkt aus dem Browser des Nutzers (Nutzungsbedingungen gelten trotzdem, IP an Dritte, bricht headless). Offen bleibt die Grenze 10.000 Abrufe/Tag; Ausweg bei Wachstum: DWD MOSMIX (Abrufe unabhängig von der Nutzerzahl) oder bezahlter Tarif.
   - Hintergrund für Rückfragen: ICON-D2 (≈ 2 km) rechnet der DWD selbst; Open-Meteo verfeinert nicht, es wählt nur die höhenpassende Zelle. MOSMIX ist kein Raster, sondern Stationsvorhersage (ICON + ECMWF, statistisch korrigiert), 10 Tage. wetter.com nennt seine Quellen nicht (16 Tage deuten auf GFS/ECMWF). ECMWF ist seit 01.10.2025 offen (CC BY 4.0, 15 Tage, 25 km).
2. **Abruf nur auf Anfrage**, Cache gilt bis zur nächsten **vollen oder halben Stunde** (`takt: 1800`, Rahmen setzt `gueltigBis`, Router den CDN-Cache).
3. **15 Tage** (bis 0.24.1: 16; Tag 16 kam oft leer), ab Tag 8 `trend: true` (nur im Datenformat; seit 0.24.4 zeigt DAILY keinen „Trend“ mehr, Hinweis „ohne Gewähr“ im Dienstblatt).
4. **Zusatzwerte:** Windrichtung, Wind/Böen je Stunde und Tagesmaximum, Sonnenstunden, Bewölkung, UV je Stunde, Luftdruck mit 3-h-Tendenz, Sichtweite, Taupunkt, Neuschnee, Schneehöhe, Nullgradgrenze, Frost, Glätte.
5. **Regen und Radar werden ein eigener Dienst `regen`** (DWD-Radar alle 5 min + RADVOR 2 h, frei auch kommerziell; weltweit RainViewer nur nicht kommerziell). Die Wetterkachel kann beide Dienste zusammen zeigen.
6. Später zu besprechen: „Immer meinen aktuellen Standort verwenden“; Trend über Tag 16 hinaus nicht nötig.

## Backlog / bekannte Kleinigkeiten (Stand 29.09.2026)
- Ort: 130 Kreisnamen ohne Typ („Zwickau“ statt „Landkreis Zwickau“); Stadtteilnamen der Quelle teils doppelt („Stuttgart Stuttgart-Mitte“).
- Wetter: Luftqualität/Pollen aus DWD/UBA prüfen. (Radarkarte mit Landkarte: erledigt 0.29.0.)
- Radarkarte: Nutzungsbedingungen basemap.de im Wortlaut prüfen (PDF war nicht abrufbar) – `../recht/checkliste.md`; Zoom fest 9 (Kartenschrift bei großer Kachel etwas weich) – bei Bedarf Zoom 10 für große Karten; außerhalb Deutschlands keine Landkarte (heller Grund).
- Namenstage: kleinere Tage aus dem Gedächtnis zusammengestellt – Roger meldet falsche Namen, Korrektur direkt in der Liste.
- Vercel hat zweimal einen Push verpasst (28.09. und 29.09.) – Git-Verbindung in Vercel prüfen (Settings → Git, Deployments).
- ~~Wetter klein bei 1100 px: Sonnenzahl ragt heraus~~ – überholt durch die Mini-Reiter (0.32.0); schmale Form des Zeitpunkt-Blocks.
- Später zu besprechen: „Immer meinen aktuellen Standort verwenden“, Ort je Kachel, Kachelauswahl in den Einstellungen.
- Arbeitsweg Auto: Autobahnen aus Start und Ziel vorschlagen (heute von Hand); aufgelöster Start/Ziel („→ Dresden (Sachsen)“) erscheint im Zahnrad erst beim nächsten Öffnen; Richtung nicht gefiltert (beide Richtungen, für Hin- und Rückweg gewollt).
- Autobahn öffentlich: API ohne Lizenzangabe, Staumeldungen teils INRIX – vor dem öffentlichen Start klären (`../recht/checkliste.md`).

## Nächste Schritte (in dieser Reihenfolge)
00. **Architektur-Review vom 02.10.2026** (`../architektur/review-2026-10-02.md`): H1 entschieden (`entscheidungen.md` Abschnitt 14 – jeder Dienst einzeln, kein Paket, Adresse = Cache-Schlüssel, `feiertage` je Bundesland). Schritt 1 ✅ 0.39.0 (Paket entfernt, Browser schickt nur das Nötige). Schritt 2 ✅ 0.40.0 (Server prüft die Angaben je Dienst, `parameter` in jedem Dienst, Unbekanntes → 400; Ortsdienste ohne Namen, den setzt die Oberfläche ein). H2 ✅ 0.41.0 (letzte gute Antwort bis 1 Std. bei Ausfall, Quellenfehler 60 s gemerkt, Tankerkönig-Bremse 30/min; Firewall-Regel vor dem Start). M1–M3 ✅ 0.42.0 (Seitensymbole nur Rasterbilder, Content Security Policy, Kennwort für den privaten Betrieb, `termine` sicher abrufen, `daily.json` nach `services/daten/`). Offen aus dem Review: M4 (Aufklappen entfernen, `board.js` aufteilen – hängt an Sport), M5 (Tests im Vercel-Build), M6 (Vertragsversion im Browser prüfen), Niedrig-Punkte. Neu auf der Liste: Tanken/Radar mit genauer Position, Firmen-Einträge im Ortsbestand, Wetter gröber runden (Idee), deutsche Dienste im Ausland nicht abfragen.
0a. **Tagesinhalte mit Verlauf und Favoriten** (`entscheidungen.md` → „Tagesinhalte mit Verlauf …“): Schritt 1 Dienst `tagesinhalt` + Kachel „Unterhaltung“ ✅ 0.34.0. Schritt 2 Kachel **Wissen** + Dienst `andiesemtag` ✅ 0.35.0. Schritt 3 Kachel **Alltag** + Spartipp in Finanzen ✅ 0.36.0. Offen: Top 11 – wer bestimmt sie (Roger entscheidet später). **Je Schritt Plan vorlegen.**
0. **Mini-Reiter umsetzen** (Konzept-Entscheidung 29.09.2026, `entscheidungen.md` Abschnitt 13): (1) Baustein im Kachelraster + Kachel „Verkehr“ ✅ 0.30.0; Kachel „Finanzen“ ✅ 0.31.0 (Kurse · Zinsen & Inflation · Märkte · Spartipp; Baustein-Feld `unten`). Für Finanzen folgen die Dienste `krypto` (Reiter Märkte öffentlich, CoinGecko-Demo-Schlüssel nötig) und `strompreis` (Reiter Strom, Energy-Charts) – je eigener Plan. (2) Wetter ✅ 0.32.0 (Jetzt · Radar · Hinweise · Mehr). (3) „Meine Seiten“ ✅ 0.33.0 (Meine + Kategorien als Symbolraster). Kalender ✅ 0.37.0 (Nächste · Termine · Feiertage & Ferien · Himmel · Namenstage). Tools, Mein Daily, Deine Nutzung ✅ 0.38.0. Offen: Sport (erst Dienst `fussball` statt `api/sport.js`), dann (4) Code fürs Aufklappen entfernen (u. a. große Radar-Ansicht, große Diagramme). Handy pausiert (Roger 29.09.: nur am PC darstellen, auf neue Dienste konzentrieren). **Je Schritt Plan vorlegen.**
1. **Kachel „Verkehr“ weiter ausbauen** (Entscheidungen in `entscheidungen.md` → „Kachel Verkehr“): Schritt 2 Dienst `autobahn` ✅ 0.28.0 (Roger testet auf Vercel: Zahnrad → Autobahnen, Start, Ziel). Als Nächstes Schritt 3 Bus/Bahn über Verkehrsverbünde (`abfahrten`, `verbindung`, Start VVO). **Vorher Plan vorlegen.**
2. **Nächste Kachel auf daily/1 umziehen** – Roger wählt aus: Sport, Geld (privat), Wissen, Tagesinhalte, Schlagzeilen (privat). Vorschlag laut `dienste-katalog.md`: `tanken`, `abfahrten`, `fussball`, `an-diesem-tag`, `tagesinhalt`, `kurse`. **Vorher Plan vorlegen.** Je Dienst: Dienstblatt, Version, Tests, Frag DAILY, Kachel mit `fertig: true`, Einstellungen im Zahnrad-Reiter der Kachel.
3. Neue Dienst-Ideen von Roger aufnehmen (`dienste-katalog.md`).
4. **Vor dem öffentlichen Start:** **Firewall-Regel in Vercel für `/api/` (300 Anfragen/Minute je IP, Antwort 429 – Pflicht, Review H2)**, eigene Daten Wetter/Radar (zentral, Stufe 4), Lasttest, Vercel Pro, Recht (`../recht/checkliste.md`).
