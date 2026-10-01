# Dienst `termine` – Termine

> Erzeugt aus `services/termine.js` mit `npm run doku` – nicht von Hand bearbeiten.

Deine eigenen Termine aus iCal-Kalendern für heute und die nächsten 14 Tage – nur im privaten Betrieb.

| | |
|---|---|
| Aufruf | `GET /api/v1/termine` |
| Programmversion | 1.2.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | privat |
| Länder | weltweit |
| Gültigkeit | 60 s |

## Zweck
Zeigt in der Kachel „Kalender“, was heute und in den nächsten zwei Wochen ansteht – zusammen mit Feiertagen, Ferien und Namenstagen.

## Herkunft der Daten
- Deine eigenen Kalender über ihre iCal-Adresse (z. B. Google: „Privatadresse im iCal-Format“). Die Links stehen nur in deinem Browser (Einstellungen) und werden bei jedem Abruf mitgeschickt.
- Ersatzweise aus der Vercel-Umgebungsvariable CALENDAR_ICS_URL.

Quellen mit Lizenz:
- Deine Kalender (iCal) (ohne Angabe)

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `urls` | iCal-Links (Liste, höchstens 5) – nur per POST im JSON-Körper, nie in der Adresse |
| `zeitzone` | Zeitzone (optional, Standard Europe/Berlin) |

## Verarbeitung
- Nur im privaten Betrieb (Vercel-Variable DAILY_PRIVATE=1); öffentlich ist der Dienst gesperrt.
- Links nur per POST im JSON-Körper – nie in der Adresse, damit sie in keinem Protokoll landen. Nur https (webcal wird zu https), keine internen Adressen, höchstens 5 Kalender.
- Keine Zwischenspeicherung: weder auf dem Server noch im CDN noch im Browser-Speicher von DAILY.
- Serientermine werden aufgelöst, abgesagte Termine weggelassen; ganztägige Termine behalten ihr Datum.
- Zeitraum heute bis 14 Tage voraus, höchstens 80 Termine; Fehler je Kalender in verständlichen Worten (ohne den Link).

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `verbunden` | true = mindestens ein Kalender eingetragen |
| `heute` | heutiger Tag in der Zeitzone |
| `termine` | Termine, zeitlich sortiert (ganztägige zuerst) |
| `termine[].titel` | Titel des Termins |
| `termine[].tag` | Tag |
| `termine[].beginn` | Beginn (UTC) |
| `termine[].ende` | Ende (UTC, oder null) |
| `termine[].ganztag` | true = ganztägig |
| `termine[].kalender` | Nummer des Kalenders (1–5) |
| `fehler` | Kalender, die nicht gelesen werden konnten |
| `fehler[].kalender` | Nummer des Kalenders |
| `fehler[].meldung` | was nicht geklappt hat |

## Skalierung
| | |
|---|---|
| Klasse | D – je Eingabe – jede Eingabe ist eigen (Suche, Liste) |
| Quelle | Die Kalender-Server der Nutzer (Google, Microsoft, Apple …); je Abruf 1 Anfrage je Kalender. |
| Kosten | Je Abruf 1–5 Downloads und Auswertung, typisch 200–800 ms. |
| Cache | Keiner – private Daten; der Browser fragt alle 10 Minuten. |
| Bei 10 Mio. Aufrufen/Tag | Nicht öffentlich – nur Rogers privater Betrieb. Für eine öffentliche Fassung bräuchte es Anmeldung und eine andere Lösung. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.2.0 | 2026-10-02 | Sicher abrufen (Review M2): jede Weiterleitung einzeln geprüft (höchstens 3), aufgelöste Adresse darf nicht intern sein (auch IPv6), höchstens 2 MB je Kalender; Zugang nur mit Kennwort (Kopfzeile X-Daily-Kennwort). |
| 1.1.0 | 2026-10-02 | Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-09-28 | Erste Fassung als Dienst (vorher api/calendar.js): 14 Tage, Serientermine, ganztägige Termine, verständliche Fehler je Kalender; Links nur per POST |

