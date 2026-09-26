# DAILY – Entscheidungen (Stand 26.09.2026)

Ergebnis der Durchsicht von `daily-konzept.html`, ergänzt um die Nutzungsrecherche (`../recherche/nutzung.md`) und die rechtliche Checkliste (`../recht/checkliste.md`).

## 1. Zielgruppe
Erst für Roger selbst bauen und testen, aber so planen, dass DAILY später öffentlich werden kann.

## 2. Inhaltsquelle „des Tages“
KI-generiert + freie APIs. Fakten (Wetter, Kurse, Sport, „An diesem Tag“ …) aus APIs; Service-Texte (Rezept, Land, Buchtipp, Witz, Rätsel …) erzeugt eine KI jeden Morgen automatisch, Roger kann nachschärfen. Keine eigenen Texte zu aktuellen Ereignissen (siehe 7).

## 3. Raster 5 × 4 – Reihenfolge nach Priorität (jedes Thema nur in einer Kachel)
Reihe 1 – täglicher Kern:
1. Heute & Wetter – Wetter, Sonne, Mond, Luftqualität, Pollen (LIVE für Dresden über Open-Meteo)
2. Kalender – Termine, Geburtstage, Jahrestage, Feiertage
3. Mail – Zähler ungelesen/wichtig (Anbindung Google/IMAP, Stufe 2)
4. Schlagzeilen – Originalüberschriften + Link aus von Roger gewählten Quellen (z. B. Tagesschau, MDR Sachsen, heise), chronologisch, ohne eigene Auswahl/Zusammenfassung
5. Mein Daily – Aufgaben, Ziele, Notizen

Reihe 2 – Version 1:
6. Sport – Mein Verein, Ergebnisse, Live heute, Tabelle (nur Daten, z. B. OpenLigaDB; keine Spielberichte)
7. Geld – Märkte, Crypto als Zahlen, allgemeiner Spartipp (keine Kauf-/Verkaufsempfehlungen); Konten später
8. Spielen – Rätsel, Quiz, Wortspiel, Witz
9. Essen – Rezept, Discounter, Familie, International
10. Wissen – Wort, Buch, Lexikon-Fakten „An diesem Tag“, Zitat

Reihe 3 – später (braucht Anbindung):
11. Mobilität · 12. Gesundheit · 13. Reisen & Länder · 14. Entertainment (TV-Daten nur aus lizenzierter Quelle) · 15. Tech (Tool, Gadget, Tipp, Technikgeschichte – keine Tech-News-Texte)

Reihe 4:
16. Shopping · 17. Beziehung · 18. Pakete (Stufe 2) · 1 freier Platz · 19. Deine Nutzung (lokaler Klickzähler)

Kopfzeile: DAILY, Datum, Uhrzeit, Suchfeld „Frag DAILY“, Links „Impressum“ und „Datenschutz“ (1 Klick, Entwürfe mit Platzhaltern).

Geschätzte Abdeckung der täglichen Info-Abfragen: V1 ≈ 40 %; mit Sport, Mail-Zähler, Suchfeld und Paketstatus ≈ 65–70 %.

## 4. Interaktion Desktop
„Raster wächst mit“: Zeile und Spalte der aktiven Kachel werden breiter (Faktor 4), die anderen schrumpfen, bleiben sichtbar.

## 5. Mobil
Kompaktraster 4 × 5 mit Symbol und Kennzahl, Suchfeld darüber, ohne Scrollen. Tippen öffnet Vollbild, Wischen wechselt.

## 6. Persönliche Anbindungen in Version 1
- Kalender über privaten ICS-Link (nur lesen)
- Aufgaben & Notizen lokal im Browser
Mail, Pakete, Smartwatch, Konten → Stufe 2+.

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
- **Arbeitsablauf:** Claude schreibt geänderte Dateien in das lokale Repo und dazu eine Datei `.commit-msg.txt` mit dem Commit-Kommentar (1. Zeile Titel, dann Stichpunkte; per .gitignore ausgeschlossen). Roger startet `hochladen.cmd` per Doppelklick: zeigt Claudes Kommentar, Enter übernimmt ihn (`git commit -F`), sonst eigener Text; danach `git push` und Löschen der Kommentardatei. Vercel veröffentlicht automatisch.
- Claude führt im lokalen Repo selbst keine git-Befehle aus (die Desktop-VM kann .git/index.lock nicht zuverlässig entfernen).
- Das Konto Craibotics ist ein separates GitHub-Konto; der Claude-Connector hat dort keinen Zugriff → Repo bewusst unter RogerWilloughby.
- Hosting: Vercel (Hobby), läuft unter der vercel.app-Adresse. Domain daily.craibotics.org (GoDaddy, CNAME „daily“) folgt später.
- Zugriff nur Roger: Vercel Authentication „All Deployments“ aktiv → noch kein ausgefülltes Impressum nötig.
- Schriften selbst gehostet (kein Google Fonts).

## Design
Grau-grüner Grund, dunkelblaue aktive Kachel, Schriften Bricolage Grotesque + Figtree, Hell- und Dunkelmodus. App-Icon: Raster mit großer „D“-Kachel. Beispieltermin: „Geburtstag von Claude“.
Prototyp: `../prototyp/daily-prototyp.html`.

## Offen
- Domain daily.craibotics.org bei GoDaddy einrichten
- Belegung des letzten freien Platzes (nach Klickzähler entscheiden)
- Nächste Datenquellen: Schlagzeilen (RSS-Quellen wählen), Sport (Verein), Kalender (ICS-Link)
