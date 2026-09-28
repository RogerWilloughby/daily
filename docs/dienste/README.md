# DAILY – Dienstblätter

> Erzeugt mit `npm run doku` – nicht von Hand bearbeiten. Jeder Dienst beschreibt sich selbst im Feld `blatt` seines Moduls in `services/`.
> Dieselben Angaben liefert der Katalog `GET /api/v1/dienste`; die App zeigt sie unter „Woher kommen die Daten?“.

| Dienst | Titel | Version | Quellen | Länder | Skalierung |
|---|---|---|---|---|---|
| [`ort`](ort.md) | Standort | 1.3.2 | GeoNames Postal Codes (eigener Ortsbestand), Open-Meteo Geocoding (GeoNames) | weltweit | D |
| [`wetter`](wetter.md) | Wetter | 1.3.0 | Open-Meteo, Open-Meteo Air Quality (Copernicus CAMS) | weltweit | C |
| [`regen`](regen.md) | Regenradar | 1.0.0 | Deutscher Wetterdienst (Radar RV), Bright Sky | DE | C |
| [`wetterhinweise`](wetterhinweise.md) | Wetterhinweise | 1.0.0 | Deutscher Wetterdienst (amtliche Warnungen), Bright Sky | DE | C |
| [`feiertage`](feiertage.md) | Feiertage und Ferien | 1.0.0 | DAILY (Berechnung: Feiertage, Brückentage, Zeitumstellung, Aktionstage), OpenHolidays API (Schulferien) | DE | B |
| [`himmel`](himmel.md) | Himmel | 1.0.0 | Astronomy Engine (Berechnung), Sternschnuppen: Termine der International Meteor Organization (Mittelwerte) | weltweit | A |
| [`namenstage`](namenstage.md) | Namenstage | 1.1.0 | DAILY-Auswahl nach dem kirchlichen Kalender (Gedenktage der Heiligen) | weltweit | A |
| [`termine`](termine.md) | Termine | 1.0.0 | Deine Kalender (iCal) | weltweit | D |
| [`finanzen`](finanzen.md) | Finanzen | 1.0.0 | Europäische Zentralbank (EZB) – Referenzkurse, Leitzinsen, HVPI | weltweit | B |
| [`kurse`](kurse.md) | Kurse (privat) | 1.0.0 | Yahoo Finance (nur private Nutzung) | weltweit | B |

Skalierungsklassen: **A** berechnet – ohne Quelle, beliebig oft · **B** für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer · **C** je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar · **D** je Eingabe – jede Eingabe ist eigen (Suche, Liste)
