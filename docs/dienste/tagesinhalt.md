# Dienst `tagesinhalt` – Tagesinhalte

> Erzeugt aus `services/tagesinhalt.js` mit `npm run doku` – nicht von Hand bearbeiten.

Rätsel, Quiz (5 Fragen), Witz, Wort und Sprichwort des Tages, Rezept, Land, Film, Gesundheits-, Tech-, Beziehungs- und Spartipp – für heute oder einen vergangenen Tag.

| | |
|---|---|
| Aufruf | `GET /api/v1/tagesinhalt` |
| Programmversion | 1.3.0 |
| Vertrag (Datenformat) | daily/1, Version 1 |
| Klasse | oeffentlich |
| Länder | weltweit |
| Gültigkeit | bis zum nächsten Takt von 1440 min (z. B. :00/:30) |

## Zweck
Liefert die Tagesinhalte für die Themen-Kacheln (Unterhaltung, Wissen, Alltag) und den Spartipp der Finanzen – mit Verlauf: Pfeile blättern zu vergangenen Tagen, Favoriten verweisen auf einen Tag.

## Herkunft der Daten
- Eigene Inhalte von DAILY, mit KI vorbereitet und als feste Datei im Repo (services/daten/daily.json – nur der Dienst liest sie, sie wird nicht öffentlich ausgeliefert; erzeugt mit tools/content_2026_10.py). Keine Nachrichten, keine Inhalte Dritter.
- Rezepte, Tipps und Fakten sind allgemeine Anregungen – keine medizinische, finanzielle oder rechtliche Beratung.

Quellen mit Lizenz:
- DAILY (eigene Tagesinhalte, mit KI vorbereitet) (ohne Angabe)

## Eingabe
| Parameter | Bedeutung |
|---|---|
| `datum` | Kalendertag JJJJ-MM-TT (Standard: heute in Deutschland); nicht in der Zukunft, nicht vor dem ersten Tag |

## Verarbeitung
- Datum: Standard heute in Deutschland (Europe/Berlin). Tage in der Zukunft und vor dem ersten Tag des Vorrats werden abgelehnt (eingabe_ungueltig).
- Gibt es den Tag im Vorrat, kommt genau dieser Eintrag; nach dem letzten Tag wiederholt sich der Vorrat im Kreis (Tag im Jahr), gekennzeichnet mit wiederholt: true.
- Inhalte unverändert aus der Datei; fehlende Arten als null.
- Rätsel: Antwort, falsche Antworten und Tipps stehen offen in der Antwort (wie bei Wordle) – der Browser mischt die vier Antworten je Tag gleich für alle und prüft selbst; nichts geht an DAILY zurück.
- Quiz: ebenso offen – je Tag 5 Fragen von leicht bis schwer mit richtiger und 3 falschen Antworten und Erklärung.

## Ausgabe (`daten`)
| Feld | Bedeutung |
|---|---|
| `datum` | gezeigter Tag (JJJJ-MM-TT) |
| `heute` | heutiger Tag in Deutschland – weiter vor geht es nicht |
| `erster` | erster Tag des Vorrats – weiter zurück geht es nicht |
| `wiederholt` | true, wenn der Tag nach dem Vorrat liegt und ein Eintrag im Kreis wiederholt wird |
| `inhalt` | Inhalte des Tags je Art (null: fehlt) |
| `inhalt.raetsel` | Rätsel |
| `inhalt.raetsel.frage` | Frage |
| `inhalt.raetsel.loesung` | Lösung (ganzer Satz, nach dem Lösen) |
| `inhalt.raetsel.antwort` | richtige Antwort, kurz – für den Antwort-Knopf (fehlt: nur „Lösung zeigen“) |
| `inhalt.raetsel.falsch` | drei falsche Antworten |
| `inhalt.raetsel.tipps` | bis zu zwei Tipps, der zweite deutlicher |
| `inhalt.quiz` | Quiz: 5 Fragen von leicht bis schwer (null: fehlt) |
| `inhalt.quiz[].frage` | Frage |
| `inhalt.quiz[].antwort` | richtige Antwort |
| `inhalt.quiz[].falsch` | drei falsche Antworten |
| `inhalt.quiz[].erklaerung` | kurze Erklärung nach dem Antworten |
| `inhalt.witz` | Witz des Tages |
| `inhalt.wort` | Wort des Tages |
| `inhalt.wort.wort` | das Wort |
| `inhalt.wort.bedeutung` | Bedeutung |
| `inhalt.wort.herkunft` | Herkunft (null: unbekannt) |
| `inhalt.sprichwort` | Sprichwort des Tages |
| `inhalt.rezept` | Rezept |
| `inhalt.rezept.name` | Name |
| `inhalt.rezept.minuten` | Zubereitungszeit in Minuten |
| `inhalt.rezept.vegetarisch` | vegetarisch |
| `inhalt.rezept.zutaten` | Zutaten (für 2 Personen) |
| `inhalt.rezept.zubereitung` | Zubereitung |
| `inhalt.land` | Land des Tages |
| `inhalt.land.name` | Name |
| `inhalt.land.hauptstadt` | Hauptstadt |
| `inhalt.land.sprache` | Sprache |
| `inhalt.land.waehrung` | Währung |
| `inhalt.land.gericht` | typisches Gericht |
| `inhalt.land.fakt` | Wissenswertes |
| `inhalt.film` | Filmtipp |
| `inhalt.film.titel` | Titel |
| `inhalt.film.jahr` | Jahr |
| `inhalt.film.genre` | Genre |
| `inhalt.film.text` | Worum es geht |
| `inhalt.gesundheit` | Gesundheitstipp |
| `inhalt.gesundheit.kurz` | Überschrift |
| `inhalt.gesundheit.text` | Tipp |
| `inhalt.tech` | Tech-Tipp |
| `inhalt.tech.kategorie` | Bereich (z. B. Tastenkürzel) |
| `inhalt.tech.text` | Tipp |
| `inhalt.beziehung` | Idee für zwei |
| `inhalt.beziehung.kurz` | Überschrift |
| `inhalt.beziehung.text` | Idee |
| `inhalt.spartipp` | Spartipp |
| `inhalt.spartipp.kurz` | Überschrift |
| `inhalt.spartipp.text` | Tipp |

## Skalierung
| | |
|---|---|
| Klasse | B – für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer |
| Quelle | Feste Datei im Repo – keine externe Quelle, keine Grenzen. |
| Kosten | Datei liegt im Speicher der Funktion; Antwort < 1 ms. |
| Cache | Für alle gleich je Tag: CDN und Browser halten jede Antwort bis Mitternacht deutscher Zeit; vergangene Tage ändern sich nicht. |
| Bei 10 Mio. Aufrufen/Tag | Unkritisch: höchstens ein paar hundert verschiedene Antworten (je Tag eine), fast nur Cache-Treffer. |

Rahmen und Stufen: `../architektur/skalierung.md`

## Änderungen
| Version | Datum | Änderung |
|---|---|---|
| 1.3.0 | 2026-10-03 | Quiz zum Mitmachen: je Tag 5 Fragen von leicht bis schwer, je eine richtige und 3 falsche Antworten und eine kurze Erklärung. |
| 1.2.0 | 2026-10-03 | Rätsel zum Mitmachen: kurze richtige Antwort, 3 falsche Antworten und bis zu 2 Tipps (Lösungen offen in der Antwort, wie bei Wordle – der Browser prüft selbst). |
| 1.1.1 | 2026-10-03 | Tagestakt endet um Mitternacht deutscher Zeit statt um Mitternacht UTC (1 bzw. 2 Uhr) – auch an Tagen der Zeitumstellung. |
| 1.1.0 | 2026-10-02 | Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026). |
| 1.0.0 | 2026-10-01 | Erste Fassung: alle Tagesinhalte eines Tags aus der festen Datei, auch vergangene Tage (Verlauf), nie in die Zukunft |

