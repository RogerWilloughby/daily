# DAILY – Plan zur Neuausrichtung (Entwurf, Stand 02.10.2026)

**Status:** Entwurf zur Besprechung mit Roger. Grundlage: `entscheidungen.md` Abschnitt 0a und `ausrichtung.md` (entschieden 02.10.2026), dazu die Erkenntnisse zu Kosten und Grenzen vom selben Tag. Die offenen Fragen stehen in **Abschnitt 10**; was entschieden ist, wandert nach `entscheidungen.md`. Jeder Bauschritt bekommt vorher wie immer einen eigenen kurzen Plan.

Bereits entschieden (02.10.2026): **eine Oberfläche für Handy und Rechner** – oben Tabs, jeder Tab hat Untertabs, jeder Untertab hat die ganze Fläche. Das Kachelraster wird abgelöst.

---

## 1. Ziel und Leitplanken
- **DAILY ist Unterhaltung zum Mitmachen – „dein digitaler Abreißkalender“.** Tagesinhalte sind das Herz, Wetter und Kalender der ruhige Rahmen.
- **Ritual statt Masse:** wenig pro Tag, für alle derselbe Inhalt, dann ist Schluss.
- **Mitmachen** Stufe 1 (allein im Browser) und Stufe 2 (Ergebnis teilen ohne Konto). Keine Inhalte anderer Nutzer auf DAILY.
- **Sammeln statt Serie:** ein Sammelstück pro Tag, verpasste Tage nachholbar, Alben in Staffeln.
- **Handy zuerst**, Rechner gleichwertig – mit derselben Oberfläche.
- Bleibt gültig: **keine Nutzerdaten außer dem Ort, keine Nachrichten, keine Datenbank**, kein Konto.
- **Keine neuen Info-Dienste bis nach dem Test**; gebaute Info-Dienste nur pflegen.
- **Während des Tests nicht kommerziell** (sonst greifen Kosten, siehe Abschnitt 3).

## 2. Ausgangslage (App 0.46.1)
- **Dienste:** 16 Dienste im Format daily/1 über eine Funktion (5 von 12 Vercel-Funktionen belegt). Vertragsversion im Browser geprüft, Schema streng in Tests und Testserver, Dienste werden erst beim Aufruf geladen.
- **Qualität:** Tests laufen vor jedem Vercel-Build; `npm run zeitreise` prüft alle Tests zu 19 Zeitpunkten (Tageszeiten, Jahreszeiten, Zeitumstellung).
- **Oberfläche:** Kachelraster mit Mini-Reitern (seit 0.45.0 das einzige Bedienmodell). Die Adapter liefern ihre Reiter als Daten (`kleinReiter`) – das lässt sich in Untertabs übernehmen. Am Handy gibt es kein Vollbild mehr.
- **Inhalte:** Tagesinhalte für 31 Tage (26.09.–26.10.2026), danach laufen sie im Kreis. Rätsel nur mit „Lösung zeigen“ – noch nicht prüfbar lösbar.
- **Wiederverwendbar für Mitmachen:** Dienst `tagesinhalt` (auch vergangene Tage → Nachholen), Favoriten und „+ Aufgabe“ im Browser, Tipps mit Verlauf.

## 3. Erkenntnisse: Kosten und Grenzen
Heute kostet nichts, und nichts kann von selbst eine Rechnung erzeugen.

| Was | Grenze heute (kostenlos) | Was dann passiert |
|---|---|---|
| **Vercel Hobby** (Hosting) | nur nicht kommerziell; im Monat 1 Mio. Edge-Anfragen, 1 Mio. Funktionsaufrufe, 100 GB, 4 Std. Rechenzeit | keine Rechnung, sondern **Seite 30 Tage pausiert**; kommerziell oder größer: Pro 20 $/Nutzer/Monat |
| **Open-Meteo** (Wetter, Luft, Ortssuche Ausland) | nur nicht kommerziell; 10.000 Aufrufe/Tag | Abo nötig |
| **Tankerkönig** (Tanken, wählbar) | nur nicht kommerziell | eigene Vereinbarung nötig |
| übrige Quellen (DWD/Bright Sky, OpenHolidays, Wikipedia, OpenLigaDB, EZB, basemap.de, eigene Dateien) | kostenlos | – |

- **Wichtigste Grenze ist Vercel, nicht ein Dienst:** Ein Öffnen von DAILY löst heute **≈ 87 Anfragen** aus (67 Programmdateien, 20 Dienst-Anfragen; gemessen im Testserver ohne Browser-Cache). Das reicht im Hobby-Tarif für ≈ 11.500 Öffnungen im Monat (≈ 380 am Tag) – unabhängig davon, welche Dienste es gibt.
- **Wetter zählt mehr als gedacht:** Open-Meteo zählt je 10 Werte einen Aufruf. Unsere Abfrage (44 Werte, 15 Tage, plus Luft) = **≈ 5–6 Aufrufe je Aktualisierung**, nicht 2 wie im Dienstblatt. Freies Kontingent ≈ 1.700 Aktualisierungen/Tag (≈ 35 dauernd genutzte Orte statt 100).
- **Neue Mitmach-Dienste kosten fast nichts:** eigene Inhalte, für alle gleich je Tag (ein Cache-Eintrag pro Tag), keine fremde Quelle. Indirekt: Arbeitszeit für Inhalte und Datenvolumen der Bilder (≈ 50 KB je Bild).
- **Für den Test (5–10 Leute) bleibt alles kostenlos.** Nach dem Test wird bei Wachstum zuerst Vercel Pro fällig, dann eventuell Open-Meteo (vermeidbar durch weniger Wetterwerte oder DWD-Vorhersagedaten MOSMIX).
- **Kommerziell** können schon Spenden oder Affiliate-Links gelten → dann gleichzeitig Vercel Pro, Open-Meteo-Abo, Tankerkönig-Vereinbarung.

## 4. Neue Oberfläche: Tabs und Untertabs
**Grundsatz:** Oben eine Tableiste mit wenigen Hauptbereichen; jeder Bereich hat Untertabs; ein Untertab füllt die ganze Fläche. Gleiche Oberfläche für Handy und Rechner – am Rechner nur breiter (Inhalte dürfen dort zweispaltig werden).

**Vorschlag Hauptbereiche (zu klären, Frage 1):**

| Tab | Untertabs (Beispiele) | Herkunft |
|---|---|---|
| **Heute** | Rätsel · Quiz · Bilderrätsel · (Witz, Wort … als Lesen) | neue Mitmach-Formate, Tagesinhalte |
| **Album** | aktuelles Album · frühere Alben · Sichern/Laden | neu |
| **Wetter** | Jetzt · Radar · Hinweise · Mehr | Reiter der Wetterkachel |
| **Kalender** | Nächste · Feiertage & Ferien · Himmel · Namenstage · (Termine privat) | Reiter der Kalenderkachel |
| **Mehr** | Meine Seiten · Mein Daily · gewählte Info-Kacheln (Tanken, Fußball, Autobahn, Abfahrten, Finanzen) · privat (Kurse, Schlagzeilen, Tools) · Einstellungen | übrige Kacheln |

**Technik (Skizze, eigener Plan vor dem Bau):**
- Die Adapter bleiben; ihre Reiter (`kleinReiter`) werden zu Untertabs. Kacheln mit eigenen Reitern unter „Mehr“ brauchen eine Lösung für die dritte Ebene (Frage 5).
- Neue Hülle statt `core/board.js`-Raster: Tableiste, Untertab-Leiste, Fläche. `core/mini-reiter.js`-Listen werden wiederverwendet; das Ausblenden ganzer Zeilen entfällt, wenn Scrollen erlaubt wird (Frage 4).
- Jeder Untertab hat eine eigene Adresse (z. B. `#heute/raetsel`): Zurück-Taste, Lesezeichen, Teilen.
- Anbieter laden nur, was sichtbar ist oder gleich gebraucht wird (spart Anfragen, siehe Abschnitt 3).
- Einstellungen „Kacheln“ werden zu „Bereiche“ (welche Info-Untertabs unter „Mehr“).
- Rauchtest (Playwright) bei Handy- und Rechnerbreiten gehört dazu.

## 5. Mitmach-Formate und Album
**Gemeinsame Grundlage (vor dem ersten Format):**
- Spielstand je Tag nur im Browser (gelöst, Ergebnis, „nachgeholt“); nichts geht an DAILY.
- Teilen ohne Konto: kurzer Text über das Teilen-Menü bzw. die Zwischenablage (z. B. „DAILY 14.10. · Quiz 4/5 🟩🟩🟩🟥🟩“).
- Nachholen vergangener Tage; der heutige Tag bleibt besonders.
- **Tageswechsel um Mitternacht deutscher Zeit** (heute endet der Cache-Tag um Mitternacht UTC = 1/2 Uhr).
- Inhalte mit Lösung in der Antwort (der Browser prüft selbst; Schummeln möglich wie bei Wordle – Frage 14).

**Vorgeschlagene Formate (Reihenfolge zu klären, Frage 8):**
1. **Rätsel zum Mitmachen** – bestehendes Rätsel: 4 Antworten statt „Lösung zeigen“, bis zu 2 Tipps. Kleinster Schritt, Inhalte zum Teil da.
2. **Quiz des Tages** – wenige Fragen mit steigender Schwierigkeit, 4 Antworten, kurze Erklärung nach jeder Frage. Eigener Name. Aufwand vor allem Inhalte (Fakten prüfen).
3. **Bilderrätsel „Bild deckt sich auf“** – Bild unter 16 Feldern, Lösung über 4 Antworten (oder Eintippen, Frage 10). Das Bild ist zugleich das **Sammelstück des Tages**.
- Alternative: **Land erraten** (Hinweise nacheinander, Daten zum Land vorhanden).

**Album:**
- Sammelstück des Tages für einen beliebigen gelösten Mitmach-Moment; verpasste Tage nachholbar.
- Erstes Album (Vorschlag): **„Vögel“** – Bilder gemeinfrei/CC0 von Wikimedia Commons, verkleinert im Repo.
- Album als Datei sichern und laden (QR-Code später); Datei mit Versionsnummer, damit spätere Alben-Formate alte Dateien lesen können.

## 6. Inhalte als Jahrgang
- Jahrgangsdatei(en) in `services/daten/` (feste Dateien, keine Datenbank); KI-Entwurf, Roger wählt aus und prüft.
- **Für den Test:** je Format mindestens die Testtage plus Puffer (Vorschlag 31 Tage, Frage 15).
- Bisherige Rubriken (Witz, Wort, Sprichwort, Rezept, Land, Film, Gesundheit, Tech, Beziehung, Spartipp): bleiben als „Lesen“, bekommen nach und nach einen Mitmach-Moment oder werden reduziert (Frage 16). Spartipp wandert aus Finanzen zu den Tagesinhalten.
- Übergang: Der Vorrat endet am 26.10. und läuft danach im Kreis – bis der Jahrgang steht (Frage 17).
- Bilder: nur gemeinfrei/CC0, Lizenz je Bild geprüft und vermerkt.

## 7. Info-Dienste: nur pflegen
- **Standardbelegung:** Wetter, Kalender, Meine Seiten, Mein Daily; Tanken, Fußball, Autobahn, Abfahrten, Finanzen wählbar, nicht vorbelegt; Abfahrten mit Hinweis „nur Raum Dresden“.
- **Pausiert:** Tanken/Radar mit genauer Position, Dienst `abfahrten` (statt `api/transit.js`), Wetter gröber runden. **Entfällt:** `krypto`, `strompreis`, Arbeitsweg Bus/Bahn.
- **Pflegepunkte (aus den Erkenntnissen):**
  - Wetter-Dienstblatt: Zahl der Aufrufe korrigieren (5–6 statt 2 je Aktualisierung).
  - Wetter: weniger Werte abfragen (44 → ≈ 20) halbiert die Open-Meteo-Aufrufe (Frage 18).
  - Tankerkönig-Bremse prüfen: Tankerkönig empfiehlt höchstens 1 Anfrage pro Minute bzw. Abfragen nur bei Bedarf; unsere Bremse lässt 30/min je Instanz zu (Frage 20).
  - Firmen-Einträge im Ortsbestand; deutsche Dienste im Ausland nicht abfragen.

## 8. Technik quer durch
- **Tagesgrenze** in deutscher Zeit (Grundlage für „des Tages“).
- **Anfragen pro Öffnen senken** (Frage 19): gleiche Anfragen nicht mehrfach stellen (Tagesinhalte heute 4× pro Öffnen), nur sichtbare Bereiche laden, später Programmdateien beim Bauen bündeln (67 → ≈ 10).
- **Firewall-Regel** bei Vercel (300/min je IP auf `/api/`) **vor dem Test**, weil die Adresse dann weitergegeben wird.
- Speicherschicht mit Versionsnummer für Spielstände und Album (Datei sichern/laden).
- Playwright-Rauchtest als Skript (Handy- und Rechnerbreiten).

## 9. Test mit 5–10 Leuten
- Zwei Wochen, Familie und Freundeskreis; **Erfolgskriterium vorher festlegen** (Vorschlag aus der Ausrichtung: mindestens die Hälfte öffnet DAILY an 4 von 7 Tagen).
- **Rückmeldung ohne Tracking** (DAILY speichert nichts): kurzer Fragebogen am Ende; freiwillig „Deine Nutzung“ teilen (Frage 21).
- Öffentlicher Betrieb (ohne private Kacheln) unter einer festen Adresse (Frage 22); vorher Impressum/Datenschutz prüfen.
- Vorher fertig: neue Oberfläche, Grundlage, 2–3 Formate, Album, Inhalte für den Testzeitraum, Firewall-Regel.

## Phasen (Reihenfolge, je Schritt eigener Plan)
| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 Klären** | Fragen aus Abschnitt 10 einzeln durchgehen | Entscheidungen in `entscheidungen.md` |
| **1 Fundament** | Tagesgrenze; neue Oberfläche (Tabs/Untertabs) mit den bestehenden Inhalten; Standardbelegung; Spartipp; doppelte Anfragen vermeiden | DAILY in neuer Form, am Handy benutzbar |
| **2 Mitmachen I** | Grundlage (Spielstand, Teilen, Nachholen) + Format 1 | erstes lösbares Format |
| **3 Mitmachen II** | Format 2; Format 3 mit Album | Mitmachen und Sammeln komplett |
| **4 Testreife** | Inhalte für den Testzeitraum; Pflegepunkte (Wetter-Werte, Tankerkönig); Firewall-Regel; Rauchtest; Fragebogen | startklar |
| **5 Test** | zwei Wochen, Auswertung | Entscheidung über Formate, Name, nächste Schritte |
| **6 Nach dem Test** | Jahrgang planen; Bündeln/Kosten; ggf. native App, Finanzierung und Lizenzen | – |

Parallel (Roger): Markenrecherche „DAILY“ (DPMA/EUIPO).

## 10. Offene Fragen (einzeln zu klären, Empfehlung in Klammern)
**Oberfläche**
1. Welche Hauptbereiche oben? (Heute · Album · Wetter · Kalender · Mehr)
2. Mit welchem Tab öffnet DAILY? (Heute)
3. Tableiste oben bestätigt – oder am Handy unten in Daumenreichweite? (oben wie gewünscht; Antwortknöpfe der Formate unten in Daumenreichweite)
4. Darf ein Untertab scrollen? (ja, wo nötig; Mitmach-Formate ohne Scrollen)
5. Kacheln mit eigenen Reitern unter „Mehr“ (z. B. Finanzen, Verkehr): Unter-Unter-Ebene oder je Reiter ein eigener Untertab? (je Kachel ein Untertab, deren Reiter als kleine Umschalter im Untertab)
6. Bleibt eine Übersicht im Stil des Kachelrasters als eigener Untertab? (nein – eine Oberfläche, weniger Pflege)
7. Können Nutzer Bereiche/Untertabs auswählen und sortieren? (nur die Info-Untertabs unter „Mehr“)

**Mitmachen und Album**
8. Erste 2–3 Formate und Reihenfolge? (Rätsel → Quiz → Bilderrätsel)
9. Quiz: 3 oder 5 Fragen am Tag, und wie heißt es? (5; Name gemeinsam festlegen)
10. Bilderrätsel: Lösen über 4 Antworten oder Eintippen? (4 Antworten – eindeutig, handyfreundlich)
11. Sammelstück: für irgendeinen gelösten Moment (Ausrichtung) – und ist das Bilderrätsel-Bild das Sammelstück? (ja)
12. Erstes Album: Thema und Start? (Vögel, Start mit dem Test)
13. Teilen-Text: nur Ergebnis oder mit Link zu DAILY? (Ergebnis + Link)
14. Lösungen offen in der Antwort (Schummeln möglich)? (ja, wie Wordle)

**Inhalte**
15. Wie viele Tage je Format für den Test, und wie prüft Roger (alles oder Stichprobe)? (31 Tage; alles beim Rätsel/Quiz, Stichprobe bei Lesen-Rubriken)
16. Bisherige Rubriken: alle behalten, reduzieren oder schrittweise zum Mitmachen umbauen? (behalten, schrittweise umbauen; Film wöchentlich)
17. Bis der Jahrgang steht: Vorrat ab 27.10. im Kreis laufen lassen? (ja, bis Phase 4)

**Kosten und Technik**
18. Wetter-Werte jetzt reduzieren (44 → ≈ 20)? (in Phase 4, vor dem Test)
19. Anfragen pro Öffnen: was vor dem Test? (doppelte vermeiden und nur Sichtbares laden in Phase 1; Bündeln nach dem Test)
20. Tankerkönig-Bremse enger stellen? (ja, Pflege in Phase 4)

**Test**
21. Erfolgskriterium und Rückmeldung? (Hälfte öffnet an 4 von 7 Tagen; Fragebogen am Ende)
22. Testadresse: Vercel-Adresse oder `daily.craibotics.org`? (eigene Domain, wenn bis Phase 4 eingerichtet)
