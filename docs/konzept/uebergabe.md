# DAILY – Übergabe: aktueller Arbeitsstand

Stand 27.09.2026. Für neue Chats: hier steht, woran gerade gearbeitet wird und wie es weitergeht. Verbindliche Entscheidungen stehen in `entscheidungen.md`, die Architektur in `../architektur/dienste.md`.

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
- **Dateien unter `.github/workflows/` darf Claude nicht schreiben** (von der Desktop-App geschützt). Claude legt sie unter `tools/` ab, Roger verschiebt sie von Hand (`move tools\x.yml .github\workflows\x.yml`).
- Für Workflow-Dateien braucht die GitHub-Anmeldung das Recht `workflow`. Eingerichtet am 27.09.: `gh auth refresh -h github.com -s workflow` und `gh auth setup-git` (Git meldet sich jetzt über die GitHub-Kommandozeile an).
- **Keine Workflows mehr (seit 27.09., Rogers Entscheidung):** Selten geänderte Daten (Ortsbestand, Namenstage) sind feste Dateien in `services/daten/`. Keine GitHub Actions, keine Erzeuger-Skripte, nichts von Hand zu starten. `.github/workflows` ist leer.
- Warum Dateien statt Datenbank: kleine, selten geänderte Daten liegen im Speicher der Funktion (< 1 ms); eine Datenbank kostete je Anfrage 5–20 ms und bräuchte trotzdem einen Abrufjob. Datenbank erst für große/oft geänderte Daten (zentrales Wetter/Radar).
- Netz: Cloud-Container und Desktop-VM erreichen nur GitHub, npm und PyPI – nicht Open-Meteo, GeoNames, DWD, destatis. Neu erzeugte Datenbestände (selten) daher auf einem Rechner mit Netz; im Alltag sind es feste Dateien.
- Tests in der Desktop-VM: dort fehlt `node_modules`, `npm test` scheitert an `node-ical`; `node --test test/dienste.test.js` läuft. Vollständig läuft `npm test` im Cloud-Container.

## Stand der Dienste
| Dienst | Stand |
|---|---|
| `ort` | ✅ fertig bis auf Rogers Test. Eigener Ortsbestand aus GeoNames (`services/daten/orte-de.json`, ≈ 14.700 Orte, Einwohnerzahlen, Großkunden gefiltert), feste Datei (keine Automatik). Suche wie eine Suchmaschine (Wörter einzeln, Kürzel Sa./Thür./Westf./Opf., Umlaute, Tippfehler, Doppelte zusammengefasst), Vorschläge beim Tippen (`land=DE`), Ausland über Open-Meteo nur, wenn kein deutscher Ort genau passt oder nur ein kleiner. Umkehrsuche (Gerätestandort) im eigenen Bestand. Ort hat seit 27.09. einen eigenen Knopf in der unteren Leiste mit eigenem Dialog (Standort ermitteln, Suche, Klick übernimmt sofort). |
| `feiertage`, `himmel` | ✅ neu 27.09. (0.12.0): Kachel „Kalender“ (Feiertage, Ferien, Brückentage, Zeitumstellung, KW, Aktionstage; Mond, Finsternisse, Sternschnuppen, Jahreszeiten). Ersetzt „Feiertage & Ferien“ und „Himmel“. Wartet auf Rogers Test. Als Nächstes: Namenstage (Wikidata), dann private Termine in der Kachel. |
| `namenstage` | ✅ neu 27.09. (0.14.0): feste Liste nach dem kirchlichen Kalender, im Kalender. Wartet auf Rogers Test. |
| `wetterhinweise` | ✅ neu 27.09. (0.10.0): amtliche DWD-Warnungen über Bright Sky in der Wetterkachel (Abzeichen, Hinweis, Reiter „Hinweise“ mit Alltagstipp) – ersetzt die Kachel „Warnungen“. Wartet auf Rogers Test. |
| `regen` | ✅ neu 27.09.: DWD-Radar über Bright Sky, 2 h Verlauf, Nähe, Karte; in der Wetterkachel. Wartet auf Rogers Test. |
| `wetter` | ✅ überarbeitet 27.09. (siehe unten): Open-Meteo, 16 Tage (ab Tag 8 Trend), Zusatzwerte, Cache-Takt :00/:30. Wartet auf Rogers Test. |
| alle anderen | noch alte Schnittstelle (`api/*.js`), Reihenfolge in `dienste-katalog.md`. **Seit 0.11.0 ausgeblendet**, nur über Einstellungen → „Alle Kacheln zeigen (Vorschau)“. Nach dem Umzug in `tiles.js` `fertig: true` setzen. |

App-Seite „Woher kommen die Daten?“ (Fußzeile → Datenquellen) zeigt die Dienstblätter aus dem Katalog `/api/v1/dienste`.

## Wetter – Entscheidungen vom 27.09.2026
1. **Quelle Open-Meteo** (nicht DWD MOSMIX), solange DAILY nicht kommerziell ist (keine Werbung, kein Abo). Grund: am wenigsten eigener Aufwand, mehr Daten (16 Tage, UV, Luft, Pollen). Verworfen: Abruf direkt aus dem Browser des Nutzers (Nutzungsbedingungen gelten trotzdem, IP an Dritte, bricht headless). Offen bleibt die Grenze 10.000 Abrufe/Tag; Ausweg bei Wachstum: DWD MOSMIX (Abrufe unabhängig von der Nutzerzahl) oder bezahlter Tarif.
   - Hintergrund für Rückfragen: ICON-D2 (≈ 2 km) rechnet der DWD selbst; Open-Meteo verfeinert nicht, es wählt nur die höhenpassende Zelle. MOSMIX ist kein Raster, sondern Stationsvorhersage (ICON + ECMWF, statistisch korrigiert), 10 Tage. wetter.com nennt seine Quellen nicht (16 Tage deuten auf GFS/ECMWF). ECMWF ist seit 01.10.2025 offen (CC BY 4.0, 15 Tage, 25 km).
2. **Abruf nur auf Anfrage**, Cache gilt bis zur nächsten **vollen oder halben Stunde** (`takt: 1800`, Rahmen setzt `gueltigBis`, Router den CDN-Cache).
3. **16 Tage**, ab Tag 8 `trend: true`; Kachel zeigt 6 Folgetage einzeln und die Trendtage zusammengefasst.
4. **Zusatzwerte:** Windrichtung, Wind/Böen je Stunde und Tagesmaximum, Sonnenstunden, Bewölkung, UV je Stunde, Luftdruck mit 3-h-Tendenz, Sichtweite, Taupunkt, Neuschnee, Schneehöhe, Nullgradgrenze, Frost, Glätte.
5. **Regen und Radar werden ein eigener Dienst `regen`** (DWD-Radar alle 5 min + RADVOR 2 h, frei auch kommerziell; weltweit RainViewer nur nicht kommerziell). Die Wetterkachel kann beide Dienste zusammen zeigen.
6. Später zu besprechen: „Immer meinen aktuellen Standort verwenden“; Trend über Tag 16 hinaus nicht nötig.

## Zuletzt offen (27.09.2026)
1. Roger testet den überarbeiteten Wetterdienst in der App.
2. Bekannte Kleinigkeiten Ort: 130 Kreisnamen ohne Typ („Zwickau“ statt „Landkreis Zwickau“); Stadtteilnamen der Quelle teils doppelt („Stuttgart Stuttgart-Mitte“); ~~Warnung Node.js 20 in der Action~~ (0.13.0: v5/Node 22; `orte-daten.yml` installiert jetzt auch die Abhängigkeiten, weil die Tests `astronomy-engine` brauchen).

## Nächste Schritte (in dieser Reihenfolge)
1. Roger testet den Dienst `regen` (Radar-Reiter, Hinweis „Regen in X Min.“). Offen: Luftqualität/Pollen prüfen (DWD-Pollenflug-Gefahrenindex, Umweltbundesamt); Radarkarte ohne Landkarte darunter – ggf. später Umrisse/Orte.
2. Roger testet mehrere Orte (Auswahlbox) und die neue aufgeklappte Kachel. Später: Kachelauswahl in den Einstellungen, ggf. Ort je Kachel.
3. Roger testet Kalender und Namenstage. Danach: private Termine (iCal) in der Kachel.
3a. Roger testet die Wetterhinweise (im Testserver mit Beispielwarnungen; echt nur bei aktueller DWD-Warnung am Ort). Freie Plätze füllen sich mit jeder überarbeiteten Kachel.
4. ~~Vercel oder AWS~~ entschieden 27.09.: Vercel; Performance-Maßnahmen 1–3 umgesetzt (0.9.0). **Vor dem öffentlichen Start:** eigene Daten Wetter/Radar (zentral), Lasttest, Vercel Pro.
5. Übrige Dienste auf daily/1 umziehen (Reihenfolge `dienste-katalog.md`), je mit Dienstblatt.
6. Neue Dienst-Ideen von Roger aufnehmen.
