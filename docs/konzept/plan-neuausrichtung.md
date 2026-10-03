# DAILY – Plan zur Neuausrichtung (Stand 03.10.2026)

**Status:** Fragen aus Phase 0 mit Roger geklärt (02./03.10.2026, einzeln). Grundlage: `entscheidungen.md` Abschnitt 0a und `ausrichtung.md`, dazu die Erkenntnisse zu Kosten und Grenzen vom 02.10.2026. Die Entscheidungen stehen in **Abschnitt 10** und in `entscheidungen.md` 0a. Jeder Bauschritt bekommt vorher wie immer einen eigenen kurzen Plan.

---

## 1. Ziel und Leitplanken
- **DAILY ist Unterhaltung zum Mitmachen – „dein digitaler Abreißkalender“.** Tagesinhalte sind das Herz, Wetter und Kalender der ruhige Rahmen.
- **Ritual statt Masse:** wenig pro Tag, für alle derselbe Inhalt, dann ist Schluss.
- **Mitmachen** Stufe 1 (allein im Browser) und Stufe 2 (Ergebnis teilen ohne Konto). Keine Inhalte anderer Nutzer auf DAILY.
- **Sammeln statt Serie:** ein Sammelstück pro Tag, verpasste Tage nachholbar, Alben in Staffeln.
- **Handy zuerst**, Rechner gleichwertig – mit **einer** Oberfläche.
- Bleibt gültig: **keine Nutzerdaten außer dem Ort, keine Nachrichten, keine Datenbank**, kein Konto.
- **Keine Info-Dienste mehr in der Oberfläche** (Tanken, Fußball, Autobahn, Abfahrten, Finanzen, Kurse, Schlagzeilen, Termine) – sie bleiben headless auf dem Server.
- **Während des Tests nicht kommerziell** (sonst greifen Kosten, Abschnitt 3).

## 2. Ausgangslage (App 0.46.1)
- **Dienste:** 16 Dienste im Format daily/1 über eine Funktion (5 von 12 Vercel-Funktionen belegt). Vertragsversion im Browser geprüft, Schema streng in Tests und Testserver, Dienste werden erst beim Aufruf geladen.
- **Qualität:** Tests laufen vor jedem Vercel-Build; `npm run zeitreise` prüft alle Tests zu 19 Zeitpunkten.
- **Oberfläche:** Kachelraster mit Mini-Reitern. Die Adapter liefern ihre Reiter als Daten (`kleinReiter`) – das lässt sich in Untertabs übernehmen. Am Handy gibt es kein Vollbild mehr.
- **Inhalte:** Tagesinhalte für 31 Tage (26.09.–26.10.2026), danach im Kreis. Rätsel nur mit „Lösung zeigen“.
- **Wiederverwendbar:** Dienst `tagesinhalt` (auch vergangene Tage → Nachholen), Favoriten im Browser, Blättern durch vergangene Tage.

## 3. Erkenntnisse: Kosten und Grenzen
Heute kostet nichts, und nichts kann von selbst eine Rechnung erzeugen.

| Was | Grenze heute (kostenlos) | Was dann passiert |
|---|---|---|
| **Vercel Hobby** (Hosting) | nur nicht kommerziell; im Monat 1 Mio. Edge-Anfragen, 1 Mio. Funktionsaufrufe, 100 GB, 4 Std. Rechenzeit | keine Rechnung, sondern **Seite 30 Tage pausiert**; kommerziell oder größer: Pro 20 $/Nutzer/Monat |
| **Open-Meteo** (Wetter, Luft, Ortssuche Ausland) | nur nicht kommerziell; 10.000 Aufrufe/Tag | Abo nötig |
| **Tankerkönig** (Tanken, nur noch headless) | nur nicht kommerziell; empfohlen höchstens 1 Anfrage/Minute | eigene Vereinbarung nötig |
| übrige Quellen (DWD/Bright Sky, OpenHolidays, Wikipedia, OpenLigaDB, EZB, basemap.de, eigene Dateien) | kostenlos | – |

- **Wichtigste Grenze ist Vercel:** Ein Öffnen von DAILY löst heute **≈ 87 Anfragen** aus (67 Programmdateien, 20 Dienst-Anfragen; gemessen im Testserver ohne Browser-Cache) → ≈ 380 Öffnungen am Tag im Hobby-Tarif. Mit der neuen Oberfläche fallen die Info-Anbieter weg, doppelte Anfragen werden vermieden und nur Sichtbares geladen (Phase 1).
- **Wetter zählt mehr als gedacht:** Open-Meteo zählt je 10 Werte einen Aufruf → unsere Abfrage (44 Werte, 15 Tage, plus Luft) ≈ **5–6 Aufrufe je Aktualisierung** (Dienstblatt sagt 2). Reduktion auf ≈ 20 Werte in Phase 4.
- **Mitmach-Dienste kosten fast nichts:** eigene Inhalte, für alle gleich je Tag, keine fremde Quelle. Indirekt: Arbeitszeit für Inhalte und Datenvolumen der Bilder (≈ 50 KB je Bild).
- **Für den Test (5–10 Leute) bleibt alles kostenlos.** Nach dem Test bei Wachstum zuerst Vercel Pro, dann ggf. Open-Meteo.
- **Kommerziell** können schon Spenden oder Affiliate-Links gelten → dann gleichzeitig Vercel Pro, Open-Meteo-Abo, Tankerkönig-Vereinbarung.

## 4. Neue Oberfläche: Tabs und Untertabs
**Grundsatz (entschieden):** eine Oberfläche für Handy und Rechner. Hauptbereiche als Tabs, jeder Bereich hat Untertabs, ein Untertab füllt die ganze Fläche. **Am Handy stehen die Haupttabs unten** (Daumenreichweite), die Untertabs oben; **am Rechner steht alles oben**. **Kein Scrollen:** jeder Untertab muss auf die Fläche passen. DAILY öffnet **immer mit „Heute“**.

| Tab | Untertabs (Entwurf) | Herkunft |
|---|---|---|
| **Heute** | Rätsel · Quiz · Bilderrätsel · Lese-Rubriken gruppiert (z. B. Lachen: Witz · Wissen: Wort, Sprichwort, Land, An diesem Tag · Alltag: Rezept, Gesundheit, Tech, Beziehung, Spartipp · Film) | Mitmach-Formate, Tagesinhalte |
| **Album** | aktuelles Album · frühere Alben · Sichern/Laden | neu |
| **Wetter** | Jetzt · Radar · Hinweise · Mehr | Reiter der Wetterkachel |
| **Kalender** | Nächste · Feiertage & Ferien · Himmel · Namenstage | Reiter der Kalenderkachel (ohne Termine) |
| **Mehr** | Meine Seiten · Tools (nur privat) · ggf. Einstellungen/Über DAILY | übrige |

**Aus der Oberfläche entfernt:** Tanken, Fußball, Autobahn, Abfahrten, Finanzen (inkl. Kurse), Schlagzeilen, Termine, Mein Daily, Deine Nutzung. Ihre Anbieter und Adapter im Browser entfallen; die Dienste bleiben auf dem Server (headless, getestet, Dienstblatt).

**Folgen von „kein Scrollen“:** Lange Inhalte werden geteilt oder geblättert (z. B. Rezept: Zutaten · Zubereitung als zwei Seiten; Album in Seiten zu z. B. 12 Feldern; Listen zeigen, was passt, wie heute `krZeilen`). Mitmach-Formate werden für Handy hochkant ohne Scrollen gestaltet.

**Technik (Skizze, eigener Plan vor dem Bau):**
- Neue Hülle statt Kachelraster: Tableiste (Handy unten / Rechner oben), Untertab-Leiste, Fläche. Die Adapter bleiben; ihre Reiter werden zu Untertabs.
- Jeder Untertab hat eine eigene Adresse (z. B. `#heute/raetsel`): Zurück-Taste, Lesezeichen, Teilen-Link.
- Anbieter laden nur, was sichtbar ist oder gleich gebraucht wird; gleiche Anfragen nur einmal.
- Einstellungen: nur noch Ort, Kennwort (privat), ggf. Meine Seiten; „Kacheln wählen“ entfällt.
- Playwright-Rauchtest bei Handy- und Rechnerbreiten.

## 5. Mitmach-Formate und Album
**Gemeinsame Grundlage (vor dem ersten Format):**
- Spielstand je Tag nur im Browser (gelöst, Ergebnis, „nachgeholt“); nichts geht an DAILY. Speicher mit Versionsnummer.
- **Teilen:** Ergebnis + Link zu DAILY über das Teilen-Menü bzw. die Zwischenablage (z. B. „DAILY 14.10. · Quiz 4/5 🟩🟩🟩🟥🟩 · daily.craibotics.org“).
- Nachholen vergangener Tage; der heutige Tag bleibt besonders.
- **Tageswechsel um Mitternacht deutscher Zeit.**
- **Lösungen offen in der Antwort** – der Browser prüft selbst (wie Wordle).

**Formate (Reihenfolge entschieden):**
1. **Rätsel zum Mitmachen** – 4 Antworten statt „Lösung zeigen“, bis zu 2 Tipps.
2. **Quiz** – **5 Fragen** mit steigender Schwierigkeit, je 4 Antworten, kurze Erklärung nach jeder Frage. **Name wird später festgelegt** (Arbeitstitel „Quiz“, vor dem Test).
3. **Bilderrätsel „Bild deckt sich auf“** – Bild unter 16 Feldern, Lösung über **4 Antworten**; jedes aufgedeckte Feld bzw. jeder falsche Tipp deckt mehr auf.

**Album:**
- **Sammelstück = Bild des Bilderrätsels**; man bekommt es für **irgendein gelöstes Format** des Tages. Verpasste Tage nachholbar.
- **Erstes Album: „Vögel“, Start mit dem ersten Testtag.** Bilder nur gemeinfrei/CC0 (Wikimedia Commons), Lizenz je Bild vermerkt, verkleinert im Repo.
- Album als Datei sichern und laden (QR-Code später).

## 6. Inhalte als Jahrgang
- Jahrgangsdatei(en) in `services/daten/`; KI-Entwurf, Roger prüft.
- **Für den Test: je Format 31 Tage.** Rätsel und Quiz prüft Roger vollständig; Bilder und Lizenzen prüft Claude und legt eine Liste vor.
- **Lese-Rubriken bleiben** und bekommen schrittweise je einen Mitmach-Moment (Pointe raten, Land erraten …). Spartipp wandert zu den Tagesinhalten (unter „Heute“).
- **Übergang:** Der Vorrat läuft ab 27.10. im Kreis weiter, bis die neuen Inhalte in Phase 4 kommen.

## 7. Info-Dienste: headless, nur pflegen
- Tanken, Fußball, Autobahn, Finanzen, Kurse, Schlagzeilen, Termine bleiben als Dienste auf dem Server (abrufbar, getestet, Dienstblatt); `api/transit.js` (Abfahrten) ebenso. Keine Oberfläche, kein Ausbau.
- **Entfällt:** `krypto`, `strompreis`, Arbeitsweg Bus/Bahn, Tanken/Radar mit genauer Position, Dienst `abfahrten`, Wetter gröber runden.
- **Pflegepunkte (Phase 4):**
  - Tankerkönig-Bremse auf **1 Anfrage/Minute** (der Schlüssel bleibt öffentlich nutzbar über den Dienst).
  - Wetter auf ≈ 20 Werte reduzieren; Dienstblatt Wetter korrigieren (Aufrufzahl).
  - Firmen-Einträge im Ortsbestand; deutsche Dienste im Ausland nicht abfragen.

## 8. Technik quer durch
- **Tagesgrenze** in deutscher Zeit (Phase 1).
- **Anfragen pro Öffnen** (Phase 1): gleiche Anfragen nur einmal (Tagesinhalte heute 4×), nur Sichtbares laden. Programmdateien bündeln (67 → ≈ 10) erst nach dem Test.
- **Firewall-Regel** bei Vercel (300/min je IP auf `/api/`) vor dem Test.
- Speicherschicht mit Versionsnummer für Spielstände und Album.
- Playwright-Rauchtest als Skript (Handy- und Rechnerbreiten).

## 9. Test mit 5–10 Leuten
- Zwei Wochen, Familie und Freundeskreis.
- **Erfolgskriterium:** mindestens die Hälfte öffnet DAILY an 4 von 7 Tagen (Selbstauskunft); **kurzer Fragebogen** am Ende. DAILY speichert nichts.
- Öffentlicher Betrieb (ohne private Teile) unter **`daily.craibotics.org`**, falls bis Phase 4 eingerichtet, sonst Vercel-Adresse. Vorher Impressum/Datenschutz prüfen.
- Vorher fertig: neue Oberfläche, Grundlage, drei Formate, Album „Vögel“, Inhalte für 31 Tage, Firewall-Regel, Pflegepunkte.

## Phasen (je Schritt eigener Plan)
| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 Klären** | ✅ 22 Fragen geklärt (02./03.10.2026) | Entscheidungen in `entscheidungen.md` |
| **1 Fundament** | ✅ 1a Tagesgrenze (0.46.2); ✅ 1b-1 neue Oberfläche „Abreißblock“ (0.47.0); ✅ 1b-2a alte Dateien gelöscht (0.47.2); ✅ 1b-2b Reste und Rechtstexte (0.47.3); offen 1c weniger Anfragen. Tagesgrenze; neue Oberfläche (Tabs/Untertabs, Handy unten/Rechner oben, kein Scrollen) mit Wetter, Kalender, Tagesinhalten, Meine Seiten, Tools; Info-Anbieter, Mein Daily, Deine Nutzung, Termine aus der Oberfläche; doppelte Anfragen vermeiden | DAILY in neuer Form, am Handy benutzbar |
| **2 Mitmachen I** | Grundlage (Spielstand, Teilen, Nachholen) + Rätsel zum Mitmachen | erstes lösbares Format |
| **3 Mitmachen II** | Quiz (5 Fragen); Bilderrätsel mit Album „Vögel“ | Mitmachen und Sammeln komplett |
| **4 Testreife** | Inhalte für 31 Tage (Rätsel, Quiz, Bilder); Quiz-Name; Pflegepunkte (Wetter-Werte, Tankerkönig); Firewall-Regel; Rauchtest; Fragebogen; Domain | startklar |
| **5 Test** | zwei Wochen, Auswertung | Entscheidung über Formate, Name, nächste Schritte |
| **6 Nach dem Test** | Jahrgang planen; Bündeln/Kosten; ggf. native App, Finanzierung und Lizenzen | – |

Parallel (Roger): Markenrecherche „DAILY“ (DPMA/EUIPO); Domain `daily.craibotics.org` einrichten.

## 10. Entscheidungen (Phase 0, Roger, 02./03.10.2026)
**Oberfläche**
1. Hauptbereiche: **Heute · Album · Wetter · Kalender · Mehr**.
2. DAILY öffnet **immer mit „Heute“**.
3. Tableiste: **Handy unten, Rechner oben** (Untertabs jeweils oben).
4. **Nie scrollen** – lange Inhalte werden geteilt oder geblättert.
5. **Die alten Info-/News-Dienste werden nicht mehr in der Oberfläche angeboten.** Unter „Mehr“ bleiben nur **Meine Seiten** und **Tools (privat)**. **Termine** verschwinden ganz aus der Oberfläche, **Mein Daily** und **Deine Nutzung** werden entfernt. Die Dienste bleiben **auf dem Server** (headless).
6. Übersicht im Kachelraster: entfällt (eine Oberfläche).
7. Auswahl/Sortierung durch Nutzer: entfällt (unter „Mehr“ gibt es nichts mehr zu wählen).

**Mitmachen und Album**
8. Formate: **Rätsel → Quiz → Bilderrätsel**.
9. Quiz: **5 Fragen**; Name **später** (vor dem Test).
10. Bilderrätsel: Lösen über **4 Antworten**.
11. Sammelstück für **irgendein gelöstes Format**; **das Bild des Bilderrätsels ist das Sammelstück**.
12. Erstes Album: **„Vögel“, Start mit dem Test**.
13. Teilen: **Ergebnis + Link** zu DAILY.
14. Lösungen **offen** in der Antwort (wie Wordle).

**Inhalte**
15. **31 Tage je Format**; Rätsel und Quiz prüft Roger **vollständig**.
16. Lese-Rubriken **behalten, schrittweise Mitmachen**.
17. Vorrat ab 27.10. **im Kreis**, bis Phase 4.

**Kosten und Technik**
18. Wetter-Werte reduzieren **in Phase 4**.
19. Anfragen: **Phase 1** doppelte vermeiden und nur Sichtbares laden; Bündeln nach dem Test.
20. Tankerkönig-Bremse auf **1/min** (Phase 4).

**Test**
21. Erfolgskriterium **4 von 7 Tagen** (Hälfte der Tester) + **Fragebogen**.
22. Adresse **`daily.craibotics.org`** (falls bis Phase 4 eingerichtet).

**Noch offen:** Name des Quiz (vor dem Test). Details der Oberfläche sind seit 03.10.2026 entschieden (`entscheidungen.md` 0a, Schritt 1b: Variante A, Gruppen, ein Einstellungsfenster).
