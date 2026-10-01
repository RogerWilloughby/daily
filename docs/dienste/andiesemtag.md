# Dienst `andiesemtag` – An diesem Tag

> Erzeugt aus `services/andiesemtag.js` mit `npm run doku` – nicht von Hand bearbeiten.

Ausgewählte geschichtliche Ereignisse eines Kalendertags aus der deutschen Wikipedia, neueste zuerst, mit Link zum Artikel.

| | |
|---|---|
| Aufruf | `GET /api/v1/andiesemtag` |
| Programmversion | 1.0.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 1440 min (z. B. :00/:30) |

## Zweck
Liefert den Reiter „An diesem Tag“ der Kachel „Wissen“ – für heute und, beim Zurückblättern, für vergangene Tage.

## Herkunft der Daten
- Wikimedia-Feed „onthisday“ der deutschen Wikipedia (api.wikimedia.org, Ausweich: de.wikipedia.org/api/rest_v1). Frei, ohne Schlüssel.
- Texte stehen unter CC BY-SA 4.0: Die Kachel nennt die Quelle und verlinkt jede Zeile auf den Wikipedia-Artikel.

Quellen mit Lizenz:
- Wikipedia – „An diesem Tag“ (Wikimedia-Feed) (CC BY-SA 4.0) – https://de.wikipedia.org

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `datum` | Kalendertag JJJJ-MM-TT (Standard: heute in Deutschland); nicht in der Zukunft, nicht vor 2000-01-01 |

## Verarbeitung
- Datum: Standard heute in Deutschland (Europe/Berlin). Tage in der Zukunft und vor 2000 werden abgelehnt (eingabe_ungueltig).
- Abgefragt wird nur Monat und Tag: zuerst die von Wikipedia ausgewählten Ereignisse („selected“); sind es weniger als 3, kommen weitere Ereignisse („events“) dazu.
- Neueste zuerst, höchstens 8. Leerzeichen bereinigt, Link nur bei https. Ist Wikipedia nicht erreichbar: quelle_fehler.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `datum` | gezeigter Tag (JJJJ-MM-TT) – daraus rechnet die Oberfläche „vor … Jahren“ |
| `tag` | Monat und Tag (MM-TT), für den Wikipedia gefragt wurde |
| `ereignisse` | Ereignisse, neueste zuerst |
| `ereignisse[].jahr` | Jahr des Ereignisses (negativ: vor Christus) |
| `ereignisse[].text` | kurze Beschreibung aus Wikipedia |
| `ereignisse[].link` | Wikipedia-Artikel zum Ereignis (null: keiner) |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | Wikimedia-Feed: frei, ohne Schlüssel; Wikimedia bittet um eine eindeutige Kennung (User-Agent mit Kontakt) und maßvolle Abrufe. |
| Kosten | Je Tag und Datum ein bis zwei Abrufe bei Wikimedia, Antwort klein (< 5 KB). |
| Cache | Für alle gleich je Datum: CDN und Instanz halten jede Antwort bis Mitternacht (UTC). |
| Bei 10 Mio. Aufrufen/Tag | Unkritisch: an einem Tag fast nur das heutige Datum (dazu wenige vergangene) – also eine Handvoll Abrufe bei Wikimedia, der Rest sind Cache-Treffer. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.0.0 | 2026-10-01 | Erste Fassung: ersetzt api/onthisday.js, jetzt mit Datum (Verlauf), nie in die Zukunft |

