# DAILY – Übergabe: aktueller Arbeitsstand

Stand 28.09.2026 (App 0.20.1). Für neue Chats: hier steht, woran gerade gearbeitet wird und wie es weitergeht. Verbindliche Entscheidungen stehen in `entscheidungen.md`, die Architektur in `../architektur/dienste.md`.

## Vorgehen (Rogers Vorgaben)
- **Erst Plan, dann Umsetzung (Rogers Vorgabe vom 27.09.2026):** Vor jeder Umsetzung und vor jedem Schreiben ins Repo einen kurzen Plan vorlegen – was und warum, welche Dateien (neu/geändert/gelöscht), was Roger danach tun muss, was offen/unsicher ist – und auf Rogers OK warten. Nicht einfach loslegen.
- **Der Reihe nach, einzeln:** ein Punkt pro Schritt, Entscheidungen per Rückfrage. Erst testen, dann zum nächsten Dienst. Nicht vorgreifen („Warum beschäftigen wir uns schon mit dem Wetter, wenn wir doch noch am Standort arbeiten?“).
- **Headless:** Dienste liefern reine Daten im Format daily/1, Adapter und Oberflächen stellen dar. Jeder Dienst wird einzeln gebaut und in der Kachelansicht getestet.
- **Transparenz:** Jeder Dienst hat ein Dienstblatt (Herkunft, Zweck, Eingabe, Ausgabe, Verarbeitung, Skalierung) – siehe `../dienste/`.
- **Skalierung:** Für jeden Dienst die Frage „10 Mio. Aufrufe/Tag?“ – Rahmen in `../architektur/skalierung.md`.
- **Qualität:** „Die Ortseingabe muss 100 % perfekt sein“ – Maßstab ist Google. Jeder gemeldete Fehlfall wird ein Testfall in `test/dienste.test.js`.
- **Strategie öffentlich:** keine Nutzerdaten außer dem Ort, keine Nachrichten. Kalender und Schlagzeilen nur privat. Mail und Pakete gestrichen.
- Roger liefert später weitere Dienst-Ideen.

## Arbeitsablauf und Stolpersteine
- **Versionen (seit 27.09.2026, App 0.6.0):** bei jeder Änderung App-Nummer (`package.json` + `src/js/core/version.js`) und betroffene Dienst-`programmversion` + `aenderungen` erhöhen. Details `../architektur/dienste.md` → Versionen.
- Hochladen nur über `hochladen.cmd` (siehe Wegweiser im Projekt). Claude schreibt Dateien ins lokale Repo und legt `.commit-msg.txt` an; lokal nie git-Befehle.
- `hochladen.cmd` lädt seit 27.09. auch liegengebliebene Commits nach (wenn ein Push fehlschlug und nichts Neues zu committen ist).
- **Keine Workflows mehr (seit 27.09., Rogers Entscheidung):** Selten geänderte Daten (Ortsbestand, Namenstage) sind feste Dateien in `services/daten/`. Keine GitHub Actions, keine Erzeuger-Skripte, nichts von Hand zu starten. `.github/workflows` ist leer (für Claude ohnehin gesperrt). Rogers Git-Anmeldung hat seit 27.09. das Recht `workflow` (`gh auth`), falls doch einmal nötig.
- Warum Dateien statt Datenbank: kleine, selten geänderte Daten liegen im Speicher der Funktion (< 1 ms); eine Datenbank kostete je Anfrage 5–20 ms und bräuchte trotzdem einen Abrufjob. Datenbank erst für große/oft geänderte Daten (zentrales Wetter/Radar).
- Netz: Cloud-Container und Desktop-VM erreichen nur GitHub, npm und PyPI – nicht Open-Meteo, GeoNames, DWD, destatis. Neu erzeugte Datenbestände (selten) daher auf einem Rechner mit Netz; im Alltag sind es feste Dateien.
- **Vercel baut nicht nach dem Hochladen (28.09.):** Der Push kam auf GitHub an, Vercel hat ihn verpasst. „Redeploy“ auf einem alten Eintrag baut nur **diesen alten Stand** neu – stattdessen „Create Deployment“ mit `main` oder einfach neu hochladen (ein neuer Push löst Vercel aus).
- **Privater Betrieb:** Vercel-Variable `DAILY_PRIVATE=1` (Production) – gesetzt am 28.09. Ohne sie läuft die Seite öffentlich: keine Termine, keine Schlagzeilen, kein Feld für Kalender-Links. Environment Variables liegen in der Vercel-Oberfläche in der **Seitenleiste des Projekts** (nicht unter Settings), direkt: https://vercel.com/rogerwilloughbys-projects/daily/settings/environment-variables. Nach dem Ändern einer Variable: Redeploy des obersten (aktuellen) Eintrags.
- Roger arbeitet unter Windows meist in **PowerShell** (nicht cmd): Befehle immer mit vorherigem `cd` in den Projektordner – oder besser eine `.cmd`-Datei zum Doppelklicken.
- Tests in der Desktop-VM: dort fehlt `node_modules`, `npm test` scheitert an `node-ical`; `node --test test/dienste.test.js` läuft. Vollständig läuft `npm test` im Cloud-Container.

## Stand der Dienste
Oberfläche: Standardbelegung = nur überarbeitete Kacheln (`fertig: true` in `src/js/core/tiles.js`) – **Wetter**, **Kalender**, Meine Seiten, Mein Daily, Deine Nutzung; übrige Felder „Freier Platz“. Seit 0.16.0 wählt man die Kacheln in Einstellungen → „Kacheln“ (Aktiv/Verfügbar, Doppelklick, Ziehen); alte Kacheln stehen dort als „Vorschau“. Einstellungen einer Kachel: Zahnrad-Reiter in der Kachel (Wetter, Kalender, Tanken, Abfahrten, Sport). Details `entscheidungen.md` → 3a.

| Dienst | Kachel | Stand |
|---|---|---|
| `ort` | Leiste (Ort-Auswahl) | ✅ getestet. Eigener Ortsbestand aus GeoNames (feste Datei, ≈ 14.700 Orte), Suche wie eine Suchmaschine, Vorschläge beim Tippen, Ausland über Open-Meteo, Gerätestandort; mehrere Orte (bis 10) in der Auswahlbox. |
| `wetter` | Wetter | ✅ getestet. Open-Meteo, 16 Tage (ab Tag 8 Trend), Zusatzwerte, Takt :00/:30, Diagramme, Reiter. |
| `regen` | Wetter | ✅ getestet. DWD-Radar über Bright Sky, Reiter „Radar“, „Regen in X Min.“. |
| `wetterhinweise` | Wetter | ✅ getestet (0.11.1). Amtliche DWD-Warnungen, Abzeichen und Hinweis nur bei Warnung, Reiter „Hinweise“ immer. |
| `feiertage` | Kalender | ✅ getestet (0.12.0). Feiertage, Schulferien (OpenHolidays), Brückentage, Zeitumstellung, KW, Aktionstage; Bundesland aus dem Ort. |
| `himmel` | Kalender | ✅ getestet (0.12.0). Mond, Supermond, Sternschnuppen, Finsternisse am Ort, Jahreszeiten (Astronomy Engine). |
| `namenstage` | Kalender | ✅ getestet (0.14.0). Feste Liste nach dem kirchlichen Kalender – Korrekturen direkt in `services/daten/namenstage.json`. |
| `termine` | Kalender (nur privat) | ✅ getestet (0.15.0). Eigene Termine aus iCal, 14 Tage, Links per POST, nie zwischengespeichert. |
| übrige | – | noch alte Schnittstelle (`api/*.js`), ausgeblendet: Tanken, Abfahrten, Sport (Fußball), Geld (Kurse, privat), Wissen (Wort, „An diesem Tag“), Tagesinhalte (Rätsel, Essen, Land, Film, Gesundheit, Tech, Sparen, Beziehung), Schlagzeilen (privat). Nach dem Umzug in `tiles.js` `fertig: true` setzen. |

App-Seite „Woher kommen die Daten?“ (Fußzeile → Datenquellen) zeigt die Dienstblätter aus dem Katalog `/api/v1/dienste`.

## Wetter – Entscheidungen vom 27.09.2026
1. **Quelle Open-Meteo** (nicht DWD MOSMIX), solange DAILY nicht kommerziell ist (keine Werbung, kein Abo). Grund: am wenigsten eigener Aufwand, mehr Daten (16 Tage, UV, Luft, Pollen). Verworfen: Abruf direkt aus dem Browser des Nutzers (Nutzungsbedingungen gelten trotzdem, IP an Dritte, bricht headless). Offen bleibt die Grenze 10.000 Abrufe/Tag; Ausweg bei Wachstum: DWD MOSMIX (Abrufe unabhängig von der Nutzerzahl) oder bezahlter Tarif.
   - Hintergrund für Rückfragen: ICON-D2 (≈ 2 km) rechnet der DWD selbst; Open-Meteo verfeinert nicht, es wählt nur die höhenpassende Zelle. MOSMIX ist kein Raster, sondern Stationsvorhersage (ICON + ECMWF, statistisch korrigiert), 10 Tage. wetter.com nennt seine Quellen nicht (16 Tage deuten auf GFS/ECMWF). ECMWF ist seit 01.10.2025 offen (CC BY 4.0, 15 Tage, 25 km).
2. **Abruf nur auf Anfrage**, Cache gilt bis zur nächsten **vollen oder halben Stunde** (`takt: 1800`, Rahmen setzt `gueltigBis`, Router den CDN-Cache).
3. **16 Tage**, ab Tag 8 `trend: true`; Kachel zeigt 6 Folgetage einzeln und die Trendtage zusammengefasst.
4. **Zusatzwerte:** Windrichtung, Wind/Böen je Stunde und Tagesmaximum, Sonnenstunden, Bewölkung, UV je Stunde, Luftdruck mit 3-h-Tendenz, Sichtweite, Taupunkt, Neuschnee, Schneehöhe, Nullgradgrenze, Frost, Glätte.
5. **Regen und Radar werden ein eigener Dienst `regen`** (DWD-Radar alle 5 min + RADVOR 2 h, frei auch kommerziell; weltweit RainViewer nur nicht kommerziell). Die Wetterkachel kann beide Dienste zusammen zeigen.
6. Später zu besprechen: „Immer meinen aktuellen Standort verwenden“; Trend über Tag 16 hinaus nicht nötig.

## Offen / bekannte Kleinigkeiten (28.09.2026)
- Ort: 130 Kreisnamen ohne Typ („Zwickau“ statt „Landkreis Zwickau“); Stadtteilnamen der Quelle teils doppelt („Stuttgart Stuttgart-Mitte“).
- Wetter: Luftqualität/Pollen aus DWD/UBA prüfen; Radarkarte ohne Landkarte darunter (ggf. Umrisse/Orte).
- Namenstage: kleinere Tage aus dem Gedächtnis zusammengestellt – Roger meldet falsche Namen, Korrektur direkt in der Liste.
- Vercel hat einmal einen Push verpasst (28.09.) – beobachten; wiederholt es sich, Git-Verbindung in Vercel prüfen.
- Später zu besprechen: „Immer meinen aktuellen Standort verwenden“, Ort je Kachel, Kachelauswahl in den Einstellungen.

## Nächste Schritte (in dieser Reihenfolge)
1. **Nächste Kachel auf daily/1 umziehen** – Roger wählt aus: Tanken, Abfahrten, Sport, Geld (privat), Wissen, Tagesinhalte, Schlagzeilen (privat). Vorschlag laut `dienste-katalog.md`: `tanken`, `abfahrten`, `fussball`, `an-diesem-tag`, `tagesinhalt`, `kurse`. **Vorher Plan vorlegen.** Je Dienst: Dienstblatt, Version, Tests, Frag DAILY, Kachel mit `fertig: true`, Einstellungen im Zahnrad-Reiter der Kachel.
2. Neue Dienst-Ideen von Roger aufnehmen (`dienste-katalog.md`).
3. **Vor dem öffentlichen Start:** eigene Daten Wetter/Radar (zentral, Stufe 4), Lasttest, Vercel Pro, Recht (`../recht/checkliste.md`).
