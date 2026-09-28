# DAILY – Entscheidungen (Stand 28.09.2026)

Ergebnis der Durchsicht von `daily-konzept.html`, ergänzt um die Nutzungsrecherche (`../recherche/nutzung.md`) und die rechtliche Checkliste (`../recht/checkliste.md`).

## 0. Strategie (Stand 26.09.2026): ohne Nutzerdaten, ohne Nachrichten
DAILY verarbeitet für die öffentliche Version **außer dem Ort keine Nutzerdaten** und zeigt **keine Nachrichten**. Mail, Nachrichten und Kalender holen sich Nutzer bei ihren eigenen Portalen – DAILY verlinkt sie nur („Meine Seiten“).
- **Gestrichen:** Mail, Pakete (brauchen Postfach/Konten).
- **Nur privat** (Vercel-Variable `DAILY_PRIVATE=1`, sonst sind der Dienst `termine` und `api/headlines` gesperrt; in Rogers Vercel-Projekt gesetzt am 28.09.2026 und die Kacheln fehlen): Kalender (iCal-Link = Nutzerdatum), Schlagzeilen (Nachrichten, Grauzone MStV).
- **Neu, nur mit dem Ort:** Feiertage & Ferien, Warnungen (DWD), Tanken, Himmel; dazu „Meine Seiten“ (nur Links, lokal gespeichert).
- Folgen: kein Konto, keine Datenbank, keine OAuth-Prüfung, kurze Datenschutzerklärung, keine Medienpflichten. Stufen 2 und 3 des Stufenplans (3b) sind damit für die öffentliche Version nicht nötig.
- Nächster Schritt: Dienste aus der Ideenliste umsetzen – Übersicht und Reihenfolge in `dienste-katalog.md`. Danach entscheiden, welche Dienste zu Kacheln/Oberflächen zusammengefasst werden (Technik für eigene Kachelauswahl vorbereitet: `settings.layout`).

## 1. Zielgruppe
Erst für Roger selbst bauen und testen, aber so planen, dass DAILY später öffentlich werden kann.

## 2. Inhaltsquelle „des Tages“
KI-generiert + freie APIs. Fakten (Wetter, Kurse, Sport, Abfahrten, „An diesem Tag“ …) aus APIs; Service-Texte (Rezept, Land, Film, Witz, Rätsel, Wort, Sprichwort, Tipps …) von einer KI vorbereitet.
**Umsetzung jetzt:** `src/content/daily.json` enthält 31 Tage (26.09.–26.10.2026), erzeugt mit `tools/content_2026_10.py`. Nach dem letzten Tag läuft der Vorrat im Kreis weiter (Tag im Jahr), die Seite bleibt also nie leer. Nachschub: Skript um den nächsten Monat erweitern, neu erzeugen, hochladen. Keine eigenen Texte zu aktuellen Ereignissen (siehe 7).

## 3. Raster 5 × 4 – Belegung (Stand der Umsetzung)
**Öffentlich** (Standard), Zeile für Zeile:
1. Wetter [Ort] · Feiertage & Ferien · Meine Seiten · Mein Daily · Abfahrten
2. Sport · Geld · Rätsel & Witz · Essen · Wissen
3. Warnungen · Tanken · Himmel · Land des Tages · Filmtipp
4. Gesundheit · Tech · Sparen · Beziehung · Deine Nutzung

**Privat** (`DAILY_PRIVATE=1`): Reihe 1 = Wetter · Kalender · Schlagzeilen · Mein Daily · Abfahrten; Feiertage und Meine Seiten rücken nach unten, Gesundheit und Beziehung entfallen.

Kacheln und Quellen:
- **Wetter** – LIVE Open-Meteo (Browser): Wetter, Regenstunde, Luft, Pollen. Ort in der Überschrift.
- **Kalender** (seit 27.09.2026, App 0.12.0) – ersetzt „Feiertage & Ferien“ und „Himmel“, siehe unten.
- ~~**Feiertage & Ferien**~~ – gesetzliche Feiertage je Bundesland, Brückentage, Zeitumstellung von DAILY berechnet (`src/js/lib/feiertage.js`, nur landesweite Feiertage); Schulferien über `api/holidays.js` (OpenHolidays API). Bundesland aus der Ortssuche.
- **Meine Seiten** – eigene Links (Mail, Nachrichtenportal, Kalender …), lokal gespeichert, öffnen im neuen Tab. Vorbelegt: Tagesschau, Gmail, Google Kalender.
- **Mein Daily** – Aufgaben lokal.
- **Abfahrten** – LIVE VVO (`api/transit.js`), Haltestelle in den Einstellungen. Nur Raum Dresden; bundesweit bräuchte eine andere Quelle.
- **Sport** – LIVE OpenLigaDB (`api/sport.js`), Verein in den Einstellungen.
- **Geld** – LIVE Yahoo (`api/markets.js`), nur privat zulässig; öffentlich: EZB-Kurse/CoinGecko oder lizenzierte Quelle.
- **Rätsel & Witz, Essen, Land, Filmtipp, Gesundheit, Tech, Sparen, Beziehung** – Tagesinhalte aus `src/content/daily.json`.
- **Wissen** – Wort, Sprichwort, „An diesem Tag“ (Wikipedia, `api/onthisday.js`).
- **Warnungen** – seit 27.09.2026 keine eigene Kachel mehr, sondern Dienst `wetterhinweise` in der Wetterkachel (siehe unten).
- **Tanken** – günstigste offene Tankstellen im Umkreis 5 km, Kraftstoff in den Einstellungen (`api/fuel.js`, Tankerkönig CC BY 4.0). Braucht Vercel-Variable `TANKERKOENIG_API_KEY` (kostenlos: onboarding.tankerkoenig.de); ohne Schlüssel zeigt die Kachel „Einrichten“.
- ~~**Himmel**~~ – Tageslänge, Sonne, Mondphase, nächster Voll-/Neumond, Sternschnuppen; ohne Netz berechnet (`src/js/lib/astro.js`).
- **Deine Nutzung** – lokaler Klickzähler.
- Nur privat: **Termine** (iCal, in der Kachel „Kalender“), **Schlagzeilen** (RSS).

## 3a. Einstellungen (seit 28.09.2026, App 0.16.0: global + je Kachel)
**Grundsatz (Roger):** Unter „Einstellungen“ stehen nur **globale** Einstellungen. Was eine Kachel oder ihr Dienst zeigt, stellt man **in der Kachel** ein – über einen Reiter mit Zahnrad (nur Symbol, kein Text), immer der letzte Reiter.
- **Globale Einstellungen** (Zahnrad-Button „Einstellungen“ unten in der Leiste):
  - **Orte:** gespeicherte Orte (höchstens 10) wählen/entfernen, „Meinen Standort ermitteln“ oder Suche mit Vorschlägen – ein Treffer wird aufgenommen und aktiv. Die Auswahlbox in der Leiste bleibt zum schnellen Wechseln; „+ Ort hinzufügen …“ / „Orte verwalten …“ öffnen die Einstellungen. Solange kein eigener Ort gespeichert ist, gilt der Beispielort Dresden. Ort je Kachel: bewusst noch nicht; später zu besprechen: „Immer meinen aktuellen Standort verwenden“.
  - **Kacheln:** zwei Listen „Aktiv“ und „Verfügbar“; **Doppelklick** (Doppeltipp, Enter) verschiebt in die andere Liste; Reihenfolge in „Aktiv“ = Platz im Raster, ändern per **Ziehen** oder ▲/▼; höchstens 20. Noch nicht überarbeitete Kacheln stehen mit „Vorschau“ unter „Verfügbar“ und lassen sich trotzdem aktivieren. Ohne eigene Belegung gilt die Standardbelegung (nur überarbeitete Kacheln). Gespeichert als `settings.layout`; beim Schließen baut sich das Raster neu auf. (Ersetzt den Schalter „Alle Kacheln zeigen (Vorschau)“.)
- **Einstellungen je Kachel** (Zahnrad-Reiter, `src/js/core/einstellungen.js`: Kachel meldet Felder an, Formular und „Speichern“ entstehen von selbst; danach wird nur ihr Anbieter neu geladen):
  - **Wetter:** Reiter Radar / 16 Tage / 48 Std. / Hinweise / Mehr ein- oder ausblenden („Heute“ immer; bei Unwetter bleibt „Hinweise“ vorn), Reiter beim Aufklappen, Mini-Diagramm 24 Stunden (Standard), 7 oder 16 Tage.
  - **Kalender:** iCal-Links (nur privat), Namenstage / Aktionstage / Himmel anzeigen.
  - **Tanken:** Kraftstoff · **Abfahrten:** Haltestelle · **Sport:** Verein (die alten Kacheln bekommen dafür einen Reiter „Übersicht“ + Zahnrad).
- Speicherung nur lokal im Browser (localStorage `daily-settings`, Kachel-Einstellungen unter `kacheln.<id>`), also pro Gerät. Späterer Ausbau: geräteübergreifend synchronisieren.

## 3b. Mehrere Nutzer – Stufenplan (durch Abschnitt 0 überholt: öffentlich bleibt es bei Stufe 1)
- **Stufe 1 (jetzt):** Nutzung ohne Konto. Einstellungen nur lokal im Browser (pro Gerät). Beim ersten Start später: Ort über Browser-Standort oder Ortssuche abfragen. Kalender per iCal-Link (für Fortgeschrittene).
- **Stufe 2:** Optionales Konto („Mit Google anmelden“ oder Anmeldelink per E-Mail) über einen fertigen Anmeldedienst. Einstellungen serverseitig in einer Datenbank, geräteübergreifend synchron. Geheime Werte (iCal-Links, Zugangstoken) verschlüsselt speichern.
- **Stufe 3:** Kalender per Knopfdruck verbinden (Google / Microsoft, nur Lesezugriff über OAuth). Google-Prüfung der App vor öffentlicher Freigabe einplanen (mehrere Wochen). iCal-Link bleibt als Alternative.
- **Voraussetzungen ab Stufe 2 (öffentlich):** ausgefülltes Impressum, vollständige Datenschutzerklärung, Auftragsverarbeitungsverträge mit Anbietern (Hosting, Datenbank, Anmeldedienst), Konto- und Datenlöschung durch den Nutzer, ggf. Datenexport. Vercel Pro statt Hobby, sobald Einnahmen entstehen.
- Die heutige Lösung (Stufe 1) bleibt als Modus ohne Konto erhalten; Stufe 2 und 3 setzen darauf auf, ohne Umbau der App.

## 4. Interaktion Desktop
„Raster wächst mit“: Zeile und Spalte der aktiven Kachel werden breiter (Faktor 4), die anderen schrumpfen, bleiben sichtbar.

## 5. Mobil
Kompaktraster 4 × 5 mit Symbol und Kennzahl, Suchfeld darüber, ohne Scrollen. Tippen öffnet Vollbild, Wischen wechselt.

## 6. Persönliche Anbindungen
- Öffentlich: keine. Aufgaben und Links nur lokal im Browser.
- Privat: Kalender über iCal-Link (nur lesen).
- Mail, Pakete, Smartwatch, Konten: gestrichen (siehe Abschnitt 0).

## 7. Kein journalistisches Angebot
DAILY soll kein journalistisch-redaktionelles Angebot sein (keine Pflichten nach §§ 18 Abs. 2, 19, 20 MStV, keine KI-Kennzeichnung nach AI Act Art. 50 für News). Deshalb gestrichen bzw. geparkt („später, nur mit Redaktion“): Politisches Thema des Tages, Faktencheck, Kritik/Meckerecke/Thema des Tages, Verbesserungsvorschläge an die Politik, von DAILY ausgewählte „wichtigste News“, eigene KI-Zusammenfassungen aktueller Ereignisse, Tech-News-Texte, Klimaereignis-Berichte, Kommentare/Abstimmungen.

## 8. Aktuell gestrichen
Cartooneyesed, Paradeyesed, Sehlat-Token / Punktesystem.

## 9. Messen statt raten
Der Prototyp zählt lokal, welche Kacheln geöffnet werden (Kachel „Deine Nutzung“). Nach ca. zwei Wochen Reihenfolge, V1-Umfang und den freien Platz überprüfen.

## 10. Betrieb
- Progressive Web App (Manifest, Service Worker, Icons), installierbar auf Desktop und Handy.
- Code: privates GitHub-Repo **github.com/RogerWilloughby/daily** (Branch main). Claude kann über den GitHub-Connector hineinschreiben.
- Lokales Repo bei Roger: `C:\Users\Roger\Documents\Projekte\Roger\Craibotics\Daily` (Ordnerfreigabe in der Desktop-App nötig). Alter Ordner Downloads\daily ist überholt.
- **Arbeitsablauf (verbindlich, Rogers Vorgabe vom 27.09.2026): immer über `hochladen.cmd`.** Claude schreibt geänderte Dateien in das lokale Repo und dazu eine Datei `.commit-msg.txt` mit dem Commit-Kommentar (1. Zeile Titel, dann Stichpunkte; per .gitignore ausgeschlossen). Roger startet `hochladen.cmd` per Doppelklick: holt zuerst den Stand von GitHub (`git pull --rebase --autostash`), zeigt Claudes Kommentar, Enter übernimmt ihn (`git commit -F`), sonst eigener Text; danach `git push` und Löschen der Kommentardatei. Vercel veröffentlicht automatisch.
- **Nicht** direkt über den GitHub-Connector schreiben (keine Branches, Pull Requests oder push_files): der Connector ist langsam und kostet viele Tokens. Er dient nur zum Lesen.
- Claude führt im lokalen Repo selbst keine git-Befehle aus, auch kein `git status` (jeder Aufruf in der Desktop-VM hinterlässt `.git/index.lock`, die hochladen.cmd blockiert).
- Das Konto Craibotics ist ein separates GitHub-Konto; der Claude-Connector hat dort keinen Zugriff → Repo bewusst unter RogerWilloughby.
- Hosting: Vercel (Hobby), läuft unter der vercel.app-Adresse. Domain daily.craibotics.org (GoDaddy, CNAME „daily“) folgt später.
- Zugriff nur Roger: Vercel Authentication „All Deployments“ aktiv → noch kein ausgefülltes Impressum nötig.
- Schriften selbst gehostet (kein Google Fonts).

## 11. Technischer Aufbau (seit 26.09.2026)
- **Seit 27.09.2026: headless.** Dienste liefern reine Daten im Austauschformat daily/1 über `GET /api/v1/<dienst>`, Adapter machen daraus Kacheln, Listen oder Dashboards. Verbindliche Beschreibung: `../architektur/dienste.md`. Referenz-Dienst: `wetter`.
- **Transparenz:** Jeder Dienst hat ein Dienstblatt (Herkunft, Zweck, Eingabe, Ausgabe, Verarbeitung, Skalierung) – im Code, im Katalog `/api/v1/dienste`, in `docs/dienste/` (`npm run doku`) und in der App unter „Datenquellen“. Skalierungsrahmen: `../architektur/skalierung.md`.
- **Aufgeklappte Kachel (27.09.2026):** oben eine Kopfzeile über die ganze Breite (Überschrift, Wert, Unterzeile, rechts „Schließen“), darunter Reiter und Inhalt über die ganze Breite – statt linker Spalte mit viel Leerraum.
- **Regenradar (27.09.2026):** eigener Dienst `regen` (DWD-Radar RV über Bright Sky, Takt 5 min): Verlauf 2 h, „Regen in X Min.“/„hört auf“, letzte Stunde, Regen in der Nähe (25 km), kleine animierte Karte (2-km-Zellen, alle 15 min). Anzeige in der Wetterkachel: Hinweis im Text und Reiter „Radar“; nur Deutschland und Randgebiete.
- **Versionen (27.09.2026):** App „DAILY 0.6.0 · Datum Uhrzeit · Commit“ (Nummer gepflegt, Rest automatisch beim Build), sichtbar in der Fußzeile, in den Einstellungen und auf der Datenquellen-Seite. Jeder Dienst hat zusätzlich zur Vertragsversion eine Programmversion mit Änderungsliste.
- **Wetterkachel (27.09.2026):** Kopfzeile „Wettersymbol Ort jetzt° · Tiefst°/Höchst°“ (Symbol erklärt sich beim Überfahren; keine große Zeile, kein festes Kachelsymbol), darunter Zustand, gefühlte Temperatur, Regen und das Mini-Diagramm 16 Tage (Höchst/Tiefst, Regenbalken, Trend gestrichelt). Mini-Diagramm beschriftet (höchster/tiefster Wert, Legende). Einheitliche Farben für Zahlen und Linien: Höchst orange, Tiefst blau, Regen grün, Sonne gelb. Aufgeklappt: Reiter „Heute“, „16 Tage“ (drei Felder Temperatur/Niederschlag/Sonne – keine zweite Y-Achse), „48 Stunden“ (Temperatur, Regenwahrscheinlichkeit), „Luft & mehr“ – alles ohne Scrollen; Hinweis je Tag/Stunde beim Überfahren; fehlende Sonnenwerte als „?“ statt 0. Diagramme sind Auswertung im Adapter (`src/js/adapter/diagramm.js`), kein eigener Dienst.
- **Wetterhinweise (27.09.2026, App 0.10.0):** Roger: „Warnungen“ ist keine entspannende Bezeichnung, die Seite soll das Leben leichter machen. Daher keine eigene Kachel, sondern Dienst `wetterhinweise` (amtliche DWD-Warnungen über Bright Sky, Takt 5 min, im Paket mit Wetter und Regen). Anzeige nur, wenn es einen Hinweis gibt: farbiges Abzeichen in der Kopfzeile der Wetterkachel (DWD-Farben gelb/orange/rot/violett), kurzer Hinweis im Text („Sturmböen ab 14 Uhr.“), Reiter „Hinweise“ mit amtlicher Überschrift, Zeitraum, amtlichem Text, Empfehlung und einem Alltagstipp von DAILY. Nachtrag 0.11.1 (Roger): Der Reiter „Hinweise“ ist immer da; ohne Warnung zeigt er ruhig „✓ Keine amtlichen Wetterhinweise für …“ mit Stand und Quelle (außerhalb Deutschlands: „nur für Orte in Deutschland“). Amtlicher Text bleibt immer unverändert sichtbar. Stufe 3–4 (Unwetter) deutlich und nicht verharmlost: „! Unwetter: …“, Hinweis vor dem Wetter, Reiter „Hinweise“ zuerst. Der frei gewordene Platz im öffentlichen Raster bleibt vorerst „Freier Platz“ (für den nächsten Dienst); privat rückt „Beziehung“ nach. „Frag DAILY“ beantwortet Warnfragen (Sturm, Glätte, Unwetter …) aus dem Dienst.
- **Wetter klein: 24 Stunden statt 16 Tage (28.09.2026, App 0.18.0):** Roger vermutete, dass die meisten das Wetter der nächsten 24 Stunden brauchen – bestätigt durch Lazo/Morss/Demuth, „300 Billion Served“ (BAMS 2009, ~1.500 Befragte): 85 % vertrauen Vorhersagen < 1 Tag stark, 78 % für 7–14 Tage kaum; am wichtigsten ist, ob/wann/wo es regnet, Temperatur folgt. Mini-Diagramm jetzt standardmäßig „24 Std.“: Temperaturlinie + Balken Regenwahrscheinlichkeit je Stunde (ab 10 %, kräftig ab 1 mm Menge, sonst blass), Zeitmarken jetzt/alle 6 Std. In den Kachel-Einstellungen wählbar: 24 Stunden, 7 Tage, 16 Tage (gespeicherte Wahl bleibt). Aufgeklappt unverändert.
- **Wetter klein: Regen in eigener Zeile (28.09.2026, App 0.18.1):** Der Regentext hat die Wetterzeile ständig umbrochen. Jetzt: Zeile 1 Kopf (Ort, Temperaturen), Zeile 2 Symbol + Wetterlage (+ Warnung, bei Unwetter vorn), Zeile 3 Schirm-Symbol + Regen. Radar geht vor; sonst Vorhersage für die nächsten 24 Stunden (passend zum Diagramm): „Regen möglich gegen 17 Uhr.“ / „Regen möglich morgen gegen 7 Uhr.“ (ab 25 %) oder „Kein Regen in den nächsten 24 Std.“. Aufgeklappt läuft der Regen im Text weiter. „Frag DAILY“ bleibt bei „heute“, weil so gefragt wird. Technik: neues Kachelfeld `zeile2 { glyph, text }`.
- **Kalender ohne Springen (28.09.2026, App 0.17.5):** Roger: Beim Auffrischen erschien kurz eine andere Kachel (gespeicherter Stand ohne Termine), dann die richtige – verwirrend. Im privaten Betrieb zeigt die Kalender-Kachel deshalb keinen gespeicherten Zwischenstand mehr, sondern wartet auf Paket und Termine (höchstens 3 s, dann ohne Termine und Termine nachgereicht); beim Auffrischen bleiben die bisherigen Termine bis dahin stehen. Termine werden weiterhin nie im Browser gespeichert. Öffentlich unverändert.
- **Wetter klein (28.09.2026, App 0.17.1):** Symbol der Wetterlage steht in der kleinen Kachel vor dem Text der Wetterlage (zweite Zeile) statt im Kopf (aufgeklappt und am Handy unverändert). Hinter Tiefst- und Höchstwert steht die Uhrzeit, zu der sie erreicht werden (kleine Kachel in Klammern „9° (2 Uhr) / 16° (14 Uhr)“, aufgeklappt „9° 2 Uhr / 16° 14 Uhr“) – Dienst `wetter` 1.3.0 liefert dafür `tage[].minZeit`/`maxZeit` aus den Stundenwerten.
- **Kleine Kacheln ohne Namen, Kalender als Liste (28.09.2026, App 0.17.0):** Roger: Platz gewinnen. Am Rechner zeigt die kleine Kachel keinen Namen (Symbol + Text) mehr; der Name erscheint seit 0.17.4 über ein kleines (i) unten rechts in der Kachel (Überfahren zeigt ein Info-Feld, Klick hält es offen, öffnet die Kachel nicht; Kalender: „Kalender / Termine“; später weitere Angaben wie Quelle oder Stand über das Kachel-Feld `info`). Nicht aufgeklappt, nicht am Handy. Im Kopf bleibt nur Inhalt: Wetter Ort und Temperaturen (Kalender: keine Kopfzeile; seit 0.17.2 steht „KW 40“ klein unten in der Kachel, und der erste Termin hat dieselbe Schriftgröße wie die Liste, bleibt aber fett). Aufgeklappt bleibt die Überschrift mit Namen; am Handy (kein Überfahren) bleibt der Kurzname. Kleine Kalender-Kachel: große Zeile = nächster eigener Termin (heute „14:00 Zahnarzt“, sonst „Mi., 30.9. 19:00 …“; öffentlich wie bisher Feiertag/Ferien), darunter untereinander die weiteren Termine (zusammen höchstens 3), kleiner Abstand, dann Feiertage/Ferien, ein Aktionstag der nächsten 7 Tage, Namenstag – höchstens 5 Zeilen. Umsetzung allgemein: Kachel-Felder `kopf` (HTML im Kopf der kleinen Kachel), `hover` (Hinweistext, sonst Name) und `liste` ([{ d, t, gruppe }], untereinander statt Fließtext).
- **Private Termine im Kalender (28.09.2026, App 0.15.0):** Die alte private Kachel „Kalender“ (iCal) ist in die Kachel „Kalender“ eingezogen – ein Kalender für alles. Dienst `termine` (daily/1, nur privat): 14 Tage, Serien, ganztägig, abgesagte weg, Fehler je Kalender; iCal-Links nur per POST (Router nimmt für private Dienste POST an), nie zwischengespeichert. Kachel: eigener Termin heute geht in der großen Zeile vor („14:00 Zahnarzt“, danach der nächste), sonst „Nächster Termin: …“ in der Zeile; Reiter „Termine“; im Reiter „Nächste“ zwischen Feiertagen und Ferien. Frag DAILY: „Was steht heute an?“, „Was habe ich morgen?“. Kalender-Links in den Einstellungen im privaten Betrieb immer sichtbar. Entfernt: `api/calendar.js`, `providers/calendar.js`, Kachel `calendar`.
- **Kachel „Kalender“ (27.09.2026, App 0.12.0):** Roger: Kalender-Kachel mit Ferienkalender, Bundesland aus dem Standort. „Himmel“ geht in „Kalender“ auf (Sonnenzeiten bleiben im Wetter). Dienste `feiertage` (Feiertage je Bundesland, Schulferien über OpenHolidays, Brückentage, Zeitumstellung, KW, Aktions- und Brauchtumstage – eigene Liste) und `himmel` (Mond, Mondphasen mit Supermond < 360.000 km, Sternschnuppen mit Mondlicht, Sonnen- und Mondfinsternisse nur wenn am Ort sichtbar, Jahreszeiten) – gerechnet mit Astronomy Engine (MIT), weil die alten Formeln nur ±½ Tag genau waren und keine Finsternisse konnten. Kachel: Kennzahl = heute Feiertag, laufende Ferien oder nächster freier Tag; Reiter „Nächste“, „Feiertage“, „Ferien“, „Himmel“; im Ausland nur Himmel. Reihenfolge: (1) diese Fassung, (2) Namenstage aus Wikidata (CC0) per GitHub Action, (3) private Termine (iCal) in derselben Kachel.
- **Namenstage und feste Daten (27.09.2026, App 0.14.0):** Namenstage im Kalender („Namenstag: …“ in der Zeile, oben im Reiter „Nächste“, Reiter „Namenstage“ mit 7 Tagen; Frag DAILY „Wann hat Josef Namenstag?“ / „Wer hat heute Namenstag?“ – Frag DAILY kann dafür auf Antworten warten). Daten: **feste, gepflegte Liste** `services/daten/namenstage.json` nach dem Allgemeinen Römischen Kalender und dem Regionalkalender für das deutsche Sprachgebiet (1–3 Namen je Tag). Der Versuch mit Wikidata per GitHub Action scheiterte (Abbruch nach 60 s, danach internationale statt deutscher Namen, Josef/Johannes/Nikolaus fehlten) und war zu aufwendig. **Roger: „weder die Namenstage noch die Orte ändern sich ständig“ → Grundsatz: selten geänderte Daten sind feste Dateien im Repo – keine Workflows, keine Skripte, keine Starts von Hand.** Der Ortsbestand bleibt feste Datei (`tools/orte-daten.js` nur für seltene manuelle Neuerzeugung); alle Workflows sind entfernt.
- **Nur überarbeitete Kacheln sichtbar (27.09.2026, App 0.11.0; Vorschau-Schalter seit 0.16.0 ersetzt durch die Kachel-Listen in den Einstellungen, siehe 3a):** Bis zum Umzug auf daily/1 sind alle nicht überarbeiteten Kacheln ausgeblendet. Sichtbar: Wetter (mit Regen und Wetterhinweisen) und die rein lokalen Kacheln Meine Seiten, Mein Daily, Deine Nutzung. Das Raster bleibt 5×4, die übrigen Felder zeigen „Freier Platz“. Kennzeichen `fertig: true` im Katalog (`src/js/core/tiles.js`); ist eine Kachel überarbeitet, wird sie dort markiert. Einstellungen → „Alle Kacheln zeigen (Vorschau)“ blendet die übrigen ein (Einstellung `alleKacheln`, lädt neu); ohne Vorschau starten deren Anbieter nicht (keine Abrufe) und ihre Einstellungen (Haltestelle, Verein, Kraftstoff, Kalender) sind ausgeblendet.
- **Wetter (27.09.2026):** Open-Meteo, solange DAILY nicht kommerziell ist; 16 Tage (ab Tag 8 Trend), Cache bis zur nächsten vollen/halben Stunde; Regen/Radar als eigener Dienst `regen` (DWD). Begründung und Verworfenes: `uebergabe.md`.
- **Eigene Daten, wo es geht:** Orte und Postleitzahlen Deutschland kommen aus dem eigenen Bestand (GeoNames, monatlich per GitHub Action), nicht mehr von OpenPLZ/Nominatim.
- Frontend ohne Bundler: `src/index.html` (nur Gerüst), `src/app.css` (Design-Tokens, Hell/Dunkel), ES-Module unter `src/js/`:
  - `core/` – `tiles.js` (Kachel-Katalog, Layouts öffentlich/privat, `chooseLayout`), `board.js` (Raster, Aktivierung, Mobil-Vollbild), `store.js` (Einstellungen, Aufgaben, Klickzähler in localStorage), `ask.js` („Frag DAILY“: jede Datenquelle meldet eigene Antworten an), `status.js` (Statusanzeige), `util.js`.
  - `providers/` – je Datenquelle ein Modul mit `load()` und Intervall (`every`). `main.js` lädt alle, aktualisiert nur bei sichtbarem Tab und meldet Fehler an die Statusanzeige.
  - Neue Kachel = Eintrag in `tiles.js` + Provider-Modul + Eintrag in `main.js`; eigene Einstellungen meldet der Provider mit `kachelEinstellungen(id, { felder, speichern })` an.
- Statusanzeige in der Leiste: „Live · HH:MM“ oder „N Quellen gestört“.
- Server-Funktionen in `api/` (Vercel, Region fra1 = Frankfurt), gemeinsame Helfer in `api/_lib/http.js`. Server-Funktionen verbergen die IP der Nutzer vor den Anbietern und setzen CDN-Cache-Zeiten.
- Service Worker `daily-<version>-<commit>` (setzt build.js je Upload): App-Dateien network-first, Schriften/Icons cache-first, `/api/` nie aus dem Cache.
- Tests: `npm test` (node:test, ohne Netz, 41 Prüfungen): `test/daily.test.js` (alte Kacheln) und `test/dienste.test.js` (daily/1: Rahmen, Schema, Ort, Wetter, Router, Katalog, Dienstblätter, Adapter).
- Lokaler Testserver: `node tools/mock-server.js` (nach `npm run build`), liefert Beispieldaten aus `tools/fixtures.js` statt echter Dienste; `MOCK_PRIVATE=1` für den privaten Betrieb.
- Betriebsart: `api/config.js` meldet `private` (aus `DAILY_PRIVATE`). `main.js` wählt damit das Layout (`chooseLayout` in `core/tiles.js`) und startet nur die passenden Anbieter. Ein eigenes Layout aus `settings.layout` (Liste von Kachel-IDs) wird geprüft und mit der Standardbelegung auf 20 Plätze aufgefüllt (reicht sie nicht, bleiben Plätze frei) – Grundlage für die Kachelauswahl in den Einstellungen.
- Reine Rechenmodule ohne DOM liegen in `src/js/lib/` (Feiertage, Astronomie, Adressprüfung) und sind so mit `npm test` prüfbar.

## Design
Grau-grüner Grund, dunkelblaue aktive Kachel, Schriften Bricolage Grotesque + Figtree, Hell- und Dunkelmodus. App-Icon: Raster mit großer „D“-Kachel. Beispieltermin: „Geburtstag von Claude“.
Prototyp: `../prototyp/daily-prototyp.html`.

## Offen
- **Roger, einmalig in Vercel (Settings → Environment Variables):** `DAILY_PRIVATE` = `1` (damit Kalender und Schlagzeilen für dich bleiben) und `TANKERKOENIG_API_KEY` (kostenlos beantragen). Danach neu veröffentlichen.
- Aktueller Arbeitsstand und nächste Schritte: `uebergabe.md`
- Wetterdienst überarbeiten (DWD direkt/Bright Sky vs. Open-Meteo, Raster, TTL), danach Vercel vs. AWS bei 10 Mio. Nutzern
- Alle Dienste auf daily/1 umstellen und neue Dienste bauen (Reihenfolge in `dienste-katalog.md`)
- Kachelauswahl in den Einstellungen: weitere Kacheln definieren (Katalog in `core/tiles.js`), Auswahl-Oberfläche bauen
- Geld für die öffentliche Version auf frei nutzbare Quellen umstellen
- Abfahrten bundesweit (andere Datenquelle) oder als Kachel nur für den VVO-Raum kennzeichnen
- Domain daily.craibotics.org bei GoDaddy einrichten
- Live-Prüfung: Warnungen (Bright Sky), Schulferien (OpenHolidays), Tanken (Tankerkönig) wurden nur mit Beispieldaten getestet
- Tagesinhalte ab 27.10.2026 nachlegen
