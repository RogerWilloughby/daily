# DAILY – Rechtliche Checkliste Web vs. App (Stand 26.09.2026, keine Rechtsberatung)

## Solange DAILY privat ist (nur Roger, nicht öffentlich erreichbar)
Kein Impressum, keine Datenschutzerklärung, keine Medienpflichten nötig. Aktuell: Vercel Authentication „All Deployments“ aktiv.

## Öffentliche Website
- Impressum nach § 5 DDG (Name, ladungsfähige Anschrift, E-Mail, schnelle Kontaktmöglichkeit, ggf. USt-IdNr.); leicht erkennbar, unmittelbar erreichbar, ständig verfügbar (BGH: max. 2 Klicks als Faustregel).
- DSGVO-Datenschutzerklärung; jede externe Anfrage (Wetter-API, Kurse) überträgt die IP → nennen oder serverseitig bündeln.
  - Stand: Direkt aus dem Browser nur Open-Meteo (Wetter, Luft, Ortssuche). Über eigene Server-Funktionen (IP bleibt beim Hoster): Kurse (Yahoo), Fußball (OpenLigaDB), Abfahrten (VVO), „An diesem Tag“ (Wikimedia), Schulferien (OpenHolidays), Wetterhinweise (Bright Sky/DWD), Tankpreise (Tankerkönig); privat zusätzlich Schlagzeilen und Kalender. Für Wetterhinweise und Tanken nur auf ~1 km gerundete Koordinaten. Entwurf in der App (Dialog „Datenschutz“) listet das bereits.
- Wikipedia-Inhalte (CC BY-SA 4.0): Quelle + Lizenz + Link nennen (umgesetzt in der Kachel Wissen).
- KI-erstellte Service-Texte (Rezept, Rätsel, Tipps …) sind keine Nachrichten; im Impressum-Entwurf als „mit KI erstellt“ vermerkt.
- Gesundheit/Sparen: nur allgemeine Anregungen mit Hinweis „keine Beratung“.
- Schriften selbst hosten (erledigt).
- § 25 TDDDG: localStorage für Funktionen, die der Nutzer will (Aufgaben, Klickzähler lokal), ohne Einwilligung ok; Analyse/Tracking an Server → Einwilligung.
- Affiliate später: klar als Werbung kennzeichnen.

## Strategie seit 26.09.2026
Öffentlich: keine Nutzerdaten außer dem Ort, keine Nachrichten. Kalender und Schlagzeilen nur im privaten Betrieb (`DAILY_PRIVATE=1`). Damit entfallen Medienpflichten (MStV) und Konto-Pflichten (Löschung, Auftragsverarbeitung für Datenbank/Anmeldedienst). Es bleiben: Impressum, kurze Datenschutzerklärung (Hosting, Open-Meteo im Browser, Server-Abrufe), Quellenangaben.
- DWD-Warnungen (Dienst `wetterhinweise`): Quelle „Deutscher Wetterdienst“ nennen (GeoNutzV) – umgesetzt (Reiter „Hinweise“, Impressum, Datenquellen). Amtlicher Text bleibt unverändert; die Alltagstipps sind klar als „Tipp“ von DAILY gekennzeichnet und ersetzen die Warnung nicht.
- Tankerkönig: CC BY 4.0, Quelle nennen – umgesetzt; Nutzungsbedingungen (Abfragehäufigkeit) beachten, Cache 5 min.
- OpenHolidays: frei nutzbar, Quelle genannt (Dienst `feiertage`, Reiter „Ferien“, Impressum).
- Namenstage (Dienst `namenstage`): eigene Liste von DAILY; Gedenktage der Heiligen sind Fakten des kirchlichen Kalenders, keine Übernahme fremder Zusammenstellungen oder Texte.
- Astronomy Engine (Dienst `himmel`): MIT-Lizenz – Lizenztext liegt mit dem npm-Paket bei; genannt in Impressum und Datenquellen. Sternschnuppen-Termine: Mittelwerte nach International Meteor Organization (Fakten, keine Übernahme von Texten).
- GeoNames (Postleitzahlen und Orte Deutschland, CC BY 4.0): eigener Ortsbestand `services/daten/orte-de.json`, Quelle in Impressum, Katalog und Seite „Woher kommen die Daten?“ genannt. CC BY verlangt Namensnennung und Hinweis auf Änderungen (wir filtern und fassen zusammen – steht im Dienstblatt `docs/dienste/ort.md`).
- Open-Meteo Geocoding (nur Ortssuche im Ausland, CC BY 4.0): kostenlos nur nicht kommerziell – vor kommerziellem Betrieb Tarif prüfen.
- Deutscher Wetterdienst, Radar RV (Dienst `regen`): Open Data nach GeoNutzV – Quellenvermerk „Deutscher Wetterdienst“ in Impressum, Katalog und Datenquellen-Seite; abgerufen über Bright Sky (Open Source, MIT). Der Abruf läuft über unseren Server, Nutzer-IPs gehen nicht an Bright Sky.
- OpenPLZ und Nominatim werden nicht mehr genutzt (seit Umstellung auf den eigenen Ortsbestand).
- Gerätestandort: nur nach Knopfdruck und Browser-Erlaubnis, auf ~1 km gerundet; die Suche nach dem nächsten Ort läuft im eigenen Bestand (keine Weitergabe an Dritte); gespeichert wird nur der gefundene Ort (im Browser). Im Datenschutz-Entwurf beschrieben.
- „Meine Seiten“: nur vom Nutzer selbst angelegte Links, keine fremden Inhalte.
- Geld: Yahoo-Daten nur privat; öffentlich andere Quelle.

## Nachrichten & Co. – Entscheidung: kein journalistisches Angebot
Ein journalistisch-redaktionelles Angebot (eigene Auswahl, Gewichtung, Zusammenfassung oder Bewertung meinungsbildender Themen) würde auslösen:
- § 18 Abs. 2 MStV: verantwortliche Person mit Name und Anschrift.
- § 19 MStV: journalistische Sorgfalt (Wahrheit/Herkunft prüfen, Meinung und Nachricht trennen, Fehler korrigieren); Aufsicht Landesmedienanstalt (Sachsen: SLM).
- § 20 MStV: Gegendarstellungsanspruch.
- AI Act Art. 50 (seit 2.8.2026): KI-generierte Texte zu Themen öffentlichen Interesses kennzeichnen – außer bei echter redaktioneller Prüfung.

Deshalb in DAILY:
- **Schlagzeilen** nur als Originalüberschriften + Link aus selbst gewählten Quellen, chronologisch, ohne eigene Auswahl/Rangfolge/Zusammenfassung.
- **Gestrichen/geparkt:** Politisches Thema, Faktencheck, Meckerecke/Kritik, „wichtigste News“, eigene KI-Zusammenfassungen aktueller Ereignisse, Tech-News-Texte, Spielberichte.
- **Unproblematisch:** Wetter, Kalender, Mail, Aufgaben, Pakete, Kurse als Zahlen, Sportergebnisse/Tabellen, Rezepte, Rätsel, Witze, Wort des Tages, Lexikon-Fakten.
- Urheberrecht / Presseverleger-Leistungsschutzrecht (§ 87f UrhG): nur Überschrift bzw. sehr kurze Auszüge + Link; RSS nach Nutzungsbedingungen der Anbieter.
- Weitere Fallen: Finanz-Tipps nur allgemein (keine Anlageempfehlungen); TV-Programmdaten nur aus lizenzierter Quelle.

## Zusätzlich als App (App Store / Google Play)
- Impressum auch im Store-Eintrag und in der App (max. 2 Klicks, Link „Impressum“); ob der Store-Eintrag allein reicht, ist gerichtlich ungeklärt → beides.
- Datenschutzerklärung in App und Store verlinkt; Apple „Datenschutz-Etiketten“ und Google „Datensicherheit“-Formular ausfüllen (müssen zu allen SDKs passen).
- OS-Berechtigungen (Standort, Kalender, Mitteilungen) nur mit Zweck, erst bei Bedarf abfragen.
- § 25 TDDDG gilt auch für Apps: Analyse-/Crash-SDKs mit Geräte-IDs → Einwilligung.
- EU-Stores: DSA-Händlerstatus angeben. Händler (Werbung, Affiliate, Abo, Kauf) → Adresse, Telefon, E-Mail öffentlich im Store. Hobby ohne Einnahmen → Nicht-Händler möglich.
- Mit Nutzerkonten: Konto muss in der App löschbar sein.
- Alternative mit weniger Aufwand: PWA (installierbare Web-App) → nur Web-Pflichten, keine Store-Regeln. (Gewählt.)

## Quellen
- eRecht24: Impressum in App Stores – https://www.e-recht24.de/impressum/10176-app-impressum.html
- LFK: Leitfaden Impressumspflicht 2024 – https://www.lfk.de/fileadmin/PDFs/Dokumente_und_Rechtsgrundlagen/Leitfaeden/leitfaden-impressumspflicht-2024.pdf
- § 25 TDDDG – https://www.gesetze-im-internet.de/ttdsg/__25.html
- FORUM Institut: KI-Kennzeichnung nach Art. 50 – https://forum-institut.de/eu-ai-act-2-august-2026/ki-kennzeichnung-nach-artikel-50
- Apple: DSA-Händleranforderungen – https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
