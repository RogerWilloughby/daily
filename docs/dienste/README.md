# DAILY – Dienstblätter

> Erzeugt mit `npm run doku` – nicht von Hand bearbeiten. Jeder Dienst beschreibt sich selbst im Feld `blatt` seines Moduls in `services/`.
> Dieselben Angaben liefert der Katalog `GET /api/v1/dienste`; die App zeigt sie unter „Woher kommen die Daten?“.

| Dienst | Titel | Quellen | Länder | Skalierung |
|---|---|---|---|---|
| [`ort`](ort.md) | Standort | GeoNames Postal Codes (eigener Ortsbestand), Open-Meteo Geocoding (GeoNames) | weltweit | D |
| [`wetter`](wetter.md) | Wetter | Open-Meteo, Open-Meteo Air Quality (Copernicus CAMS) | weltweit | C |

Skalierungsklassen: **A** berechnet – ohne Quelle, beliebig oft · **B** für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer · **C** je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar · **D** je Eingabe – jede Eingabe ist eigen (Suche, Liste)
