# DAILY – Übergabe: aktueller Arbeitsstand

Stand 27.09.2026. Für neue Chats: hier steht, woran gerade gearbeitet wird und wie es weitergeht. Verbindliche Entscheidungen stehen in `entscheidungen.md`, die Architektur in `../architektur/dienste.md`.

## Vorgehen (Rogers Vorgaben)
- **Der Reihe nach, einzeln:** ein Punkt pro Schritt, Entscheidungen per Rückfrage. Erst testen, dann zum nächsten Dienst. Nicht vorgreifen („Warum beschäftigen wir uns schon mit dem Wetter, wenn wir doch noch am Standort arbeiten?“).
- **Headless:** Dienste liefern reine Daten im Format daily/1, Adapter und Oberflächen stellen dar. Jeder Dienst wird einzeln gebaut und in der Kachelansicht getestet.
- **Transparenz:** Jeder Dienst hat ein Dienstblatt (Herkunft, Zweck, Eingabe, Ausgabe, Verarbeitung, Skalierung) – siehe `../dienste/`.
- **Skalierung:** Für jeden Dienst die Frage „10 Mio. Aufrufe/Tag?“ – Rahmen in `../architektur/skalierung.md`.
- **Qualität:** „Die Ortseingabe muss 100 % perfekt sein“ – Maßstab ist Google. Jeder gemeldete Fehlfall wird ein Testfall in `test/dienste.test.js`.
- **Strategie öffentlich:** keine Nutzerdaten außer dem Ort, keine Nachrichten. Kalender und Schlagzeilen nur privat. Mail und Pakete gestrichen.
- Roger liefert später weitere Dienst-Ideen.

## Arbeitsablauf und Stolpersteine
- Hochladen nur über `hochladen.cmd` (siehe Wegweiser im Projekt). Claude schreibt Dateien ins lokale Repo und legt `.commit-msg.txt` an; lokal nie git-Befehle.
- `hochladen.cmd` lädt seit 27.09. auch liegengebliebene Commits nach (wenn ein Push fehlschlug und nichts Neues zu committen ist).
- **Dateien unter `.github/workflows/` darf Claude nicht schreiben** (von der Desktop-App geschützt). Claude legt sie unter `tools/` ab, Roger verschiebt sie von Hand (`move tools\x.yml .github\workflows\x.yml`).
- Für Workflow-Dateien braucht die GitHub-Anmeldung das Recht `workflow`. Eingerichtet am 27.09.: `gh auth refresh -h github.com -s workflow` und `gh auth setup-git` (Git meldet sich jetzt über die GitHub-Kommandozeile an).
- Die GitHub-Actions-Seite zeigt einen Workflow erst nach dem ersten Lauf; direkter Link: https://github.com/RogerWilloughby/daily/actions/workflows/orte-daten.yml
- Netz: Cloud-Container und Desktop-VM erreichen nur GitHub, npm und PyPI – nicht Open-Meteo, GeoNames, DWD, destatis. Deshalb werden Ortsdaten per GitHub Action erzeugt.
- Tests in der Desktop-VM: dort fehlt `node_modules`, `npm test` scheitert an `node-ical`; `node --test test/dienste.test.js` läuft. Vollständig läuft `npm test` im Cloud-Container.

## Stand der Dienste
| Dienst | Stand |
|---|---|
| `ort` | ✅ fertig bis auf Rogers Test. Eigener Ortsbestand aus GeoNames (`services/daten/orte-de.json`, ≈ 14.700 Orte, Einwohnerzahlen, Großkunden gefiltert), monatlich per Action „Ortsbestand erneuern“. Suche wie eine Suchmaschine (Wörter einzeln, Kürzel Sa./Thür./Westf./Opf., Umlaute, Tippfehler, Doppelte zusammengefasst), Vorschläge beim Tippen (`land=DE`), Ausland über Open-Meteo nur, wenn kein deutscher Ort genau passt oder nur ein kleiner. Umkehrsuche (Gerätestandort) im eigenen Bestand. Knopf „Meinen Standort ermitteln“ oben in den Einstellungen. |
| `wetter` | ✅ läuft über daily/1 und Open-Meteo, Dienstblatt vorhanden. **Überarbeitung ist der nächste Schritt.** |
| alle anderen | noch alte Schnittstelle (`api/*.js`), Reihenfolge in `dienste-katalog.md` |

App-Seite „Woher kommen die Daten?“ (Fußzeile → Datenquellen) zeigt die Dienstblätter aus dem Katalog `/api/v1/dienste`.

## Zuletzt offen (27.09.2026)
1. Geprüft 27.09.: Firmennamen raus, Einwohner stimmen (München, Halle (Saale), Freiburg …), Doppelte zusammengefasst. Noch einmal Action laufen lassen für die Stadtstaaten-Korrektur („Hamburg Bergedorf“ stand unter Schleswig-Holstein).
2. Roger testet die Ortssuche in der App mit eigenen Schreibweisen – Fehlfälle als Tests aufnehmen.
3. Bekannte Kleinigkeiten: 130 Kreisnamen ohne Typ („Zwickau“ statt „Landkreis Zwickau“); Stadtteilnamen der Quelle teils doppelt („Stuttgart Stuttgart-Mitte“); Warnung Node.js 20 in der Action (bei nächster Änderung `actions/checkout@v5`, `actions/setup-node@v5`, Node 22 – Datei muss Roger dann wieder verschieben).

## Nächste Schritte (in dieser Reihenfolge)
1. **Wetter** Punkt für Punkt: DWD direkt bzw. Bright Sky (MOSMIX) statt Open-Meteo? Nur angefragte Orte abrufen statt alle; Raster und TTL; Skalierung (Open-Meteo frei nur 10.000/Tag, nicht kommerziell); Stufe „eigene Daten“.
2. **Vercel oder AWS** bei 10 Mio. Nutzern (Vercel Hobby nur nicht kommerziell; Pro 20 $/Monat, 1 Mio. Aufrufe inklusive, dann 0,60 $/Mio.).
3. Übrige Dienste auf daily/1 umziehen (Reihenfolge `dienste-katalog.md`), je mit Dienstblatt.
4. Neue Dienst-Ideen von Roger aufnehmen.
