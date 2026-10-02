# DAILY – Dienstblätter

> Erzeugt mit `npm run doku` – nicht von Hand bearbeiten. Jeder Dienst beschreibt sich selbst im Feld `blatt` seines Moduls in `services/`.
> Dieselben Angaben liefert der Katalog `GET /api/v1/dienste`; die App zeigt sie unter „Woher kommen die Daten?“.

| Dienst | Titel | Version | Quellen | Länder | Skalierung |
|---|---|---|---|---|---|
| [`ort`](ort.md) | Standort | 1.4.0 | GeoNames Postal Codes (eigener Ortsbestand), Open-Meteo Geocoding (GeoNames) | weltweit | D |
| [`wetter`](wetter.md) | Wetter | 2.0.0 | Open-Meteo, Open-Meteo Air Quality (Copernicus CAMS) | weltweit | C |
| [`regen`](regen.md) | Regenradar | 2.0.0 | Deutscher Wetterdienst (Radar RV), Bright Sky | DE | C |
| [`wetterhinweise`](wetterhinweise.md) | Wetterhinweise | 2.0.0 | Deutscher Wetterdienst (amtliche Warnungen), Bright Sky | DE | C |
| [`feiertage`](feiertage.md) | Feiertage und Ferien | 2.1.0 | DAILY (Berechnung: Feiertage, Brückentage, Zeitumstellung, Aktionstage), OpenHolidays API (Schulferien) | DE | B |
| [`himmel`](himmel.md) | Himmel | 2.0.0 | Astronomy Engine (Berechnung), Sternschnuppen: Termine der International Meteor Organization (Mittelwerte) | weltweit | A |
| [`namenstage`](namenstage.md) | Namenstage | 1.2.0 | DAILY-Auswahl nach dem kirchlichen Kalender (Gedenktage der Heiligen) | weltweit | A |
| [`termine`](termine.md) | Termine | 1.2.0 | Deine Kalender (iCal) | weltweit | D |
| [`finanzen`](finanzen.md) | Finanzen | 1.1.0 | Europäische Zentralbank (EZB) – Referenzkurse, Leitzinsen, HVPI | weltweit | B |
| [`kurse`](kurse.md) | Kurse (privat) | 1.1.0 | Yahoo Finance (nur private Nutzung) | weltweit | B |
| [`tanken`](tanken.md) | Tanken | 2.1.0 | Tankerkönig (Daten der Markttransparenzstelle für Kraftstoffe) | DE | C |
| [`autobahn`](autobahn.md) | Autobahn | 1.1.0 | Die Autobahn GmbH des Bundes (Autobahn-API) | DE | B |
| [`tagesinhalt`](tagesinhalt.md) | Tagesinhalte | 1.1.0 | DAILY (eigene Tagesinhalte, mit KI vorbereitet) | weltweit | B |
| [`andiesemtag`](andiesemtag.md) | An diesem Tag | 1.1.0 | Wikipedia – „An diesem Tag“ (Wikimedia-Feed) | weltweit | B |
| [`fussball`](fussball.md) | Fußball | 1.0.0 | OpenLigaDB (Community-Datenbank für Sportergebnisse) | weltweit | B |
| [`schlagzeilen`](schlagzeilen.md) | Schlagzeilen (privat) | 1.0.0 | Tagesschau (RSS/Atom, Originalüberschriften), MDR Sachsen (RSS/Atom, Originalüberschriften), heise (RSS/Atom, Originalüberschriften) | weltweit | B |

Skalierungsklassen: **A** berechnet – ohne Quelle, beliebig oft · **B** für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer · **C** je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar · **D** je Eingabe – jede Eingabe ist eigen (Suche, Liste)
