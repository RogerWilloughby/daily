# DAILY – Recherche: Wettbewerb (Stand 29.09.2026)

Frage: Gibt es schon eine Seite wie DAILY? Eingeordnet gegen den **aktuellen** Stand aus `../konzept/entscheidungen.md` (öffentlich außer dem Ort keine Nutzerdaten, keine Nachrichten, kein Punktesystem).
Angaben zu fremden Angeboten ändern sich – vor Entscheidungen neu prüfen.

## Kurzfazit

Eine Seite, die DAILY als Ganzes entspricht, gibt es nicht. Viele Angebote decken einzelne Teile ab. Keines verbindet:
- eine Kachelfläche ohne Scrollen, bei der die geöffnete Kachel wächst und die anderen sichtbar bleiben,
- redaktionelle Tagesinhalte („des Tages“) statt eines leeren Baukastens,
- Alltagsdaten zum Ort (Wetter mit Radar und amtlichen Hinweisen, Kalender mit Feiertagen, Ferien und Namenstagen, Finanzen, Tanken, Abfahrten),
- Deutsch und den deutschen Alltag als Ausgangspunkt,
- ohne Konto und ohne Nutzerdaten.

## Nächste Wettbewerber

### 1. Personalisierbare Startseiten (Baukasten) – am nächsten dran

| Angebot | Link | Was es ist | Abgrenzung zu DAILY |
|---|---|---|---|
| start.me | https://start.me/ | Bekanntester aktiver Anbieter. Widgets in Spalten (Lesezeichen, RSS, Notizen, Aufgaben, Wetter, Uhr, Kalender), laut Store über 3.500 Widgets. Freemium, Konto. | Leerer Baukasten, Nutzer stellt alles selbst zusammen; Konto nötig; scrollt; keine Tagesinhalte. |
| Protopage | https://www.protopage.com/ | Gilt als nächster überlebender Verwandter von iGoogle: RSS plus Widgets, Reiter „Arbeit / Privat / News“. | Dicht, altmodisch, Baukasten; keine Tagesinhalte. |
| igHome | https://www.ighome.com/ | iGoogle-Nachbau mit Gadgets. | Kaum weiterentwickelt. |
| Tab Widgets | https://chromewebstore.google.com/detail/tab-widgets-custom-new-ta/ejnndgifkmlldcdlifjaeanhjegoafcl | Browser-Erweiterung für den neuen Tab, rund 70 Widgets, ohne Konto, Pro-Stufe. | Nur Chrome-Erweiterung; Baukasten; viel Technik-Spielzeug. |
| Vivaldi-Startseite | https://help.vivaldi.com/desktop/tools/start-page-dashboard/ | Startseite des Vivaldi-Browsers mit Widgets. | An einen Browser gebunden. |

### 2. Portale und System-Widgets – Massenprodukte

| Angebot | Link | Was es ist | Abgrenzung zu DAILY |
|---|---|---|---|
| MSN | https://www.msn.com/de-de | Nachrichtenportal von Microsoft mit Wetter, Börse und Sport; mit Microsoft-Konto personalisierbar. | Nachrichten-Feed mit Scrollen und Werbung, keine ruhige Tagesübersicht. |
| Windows-Widgets | https://support.microsoft.com/de-de/windows/experience/personalization/stay-up-to-date-with-widgets-in-windows | Widget-Board in Windows 11: Wetter, Aktien, Kalender, Nachrichten, Sport, Verkehr. | Nur Windows; Inhalte aus MSN. |

### 3. KI-Morgenbriefings – neue Entwicklung, anderes Produkt

KI-Briefings sind Zusammenfassungen, die ein KI-Assistent ohne Frage von sich aus erstellt, meist morgens, aus Kalender, E-Mails, früheren Chats und teils dem Web.

| Angebot | Link | Was es ist | Abgrenzung zu DAILY |
|---|---|---|---|
| ChatGPT Pulse (OpenAI) | https://www.engadget.com/openai-introduces-personalized-daily-summaries-with-chatgpt-pulse-181532935.html | 5–10 Karten pro Tag, über Nacht erstellt; hört bewusst nach wenigen Karten auf (kein endloses Scrollen). Zuerst nur Pro-Abo, mobil. | Lebt von persönlichen Daten (Mail, Kalender, Chats) – genau das macht DAILY öffentlich nicht. Text statt Übersicht auf einen Blick. |
| Google Labs CC | https://tidbits.com/2026/05/29/taming-email-overload-googles-cc-daily-briefing-agent/ | Morgen-E-Mail „Your Day Ahead“ aus Gmail, Kalender und Drive: wichtige Themen, Termine, FYI. Zahlende Gemini-Abos, USA/Kanada. | Wie Pulse: persönliche Daten, E-Mail statt Seite. Testbericht nennt Fehler (vertauschte Namen, unpassende Termine). |

Gemeinsamer Gedanke mit DAILY: „Das Wichtigste für heute, und dann ist Schluss.“ Die Nachfrage nach „alles auf einen Blick“ wandert zu diesen Diensten.

### 4. Self-hosted Dashboards – für Technikbegeisterte

| Angebot | Link | Was es ist | Abgrenzung zu DAILY |
|---|---|---|---|
| Glance | https://github.com/glanceapp/glance | Offenes Dashboard (Go): RSS, Reddit, YouTube, Börse, Wetter, Kalender; Einrichtung per YAML-Datei, eigener Server. | Nicht für Normalnutzer. Brauchbar als Referenz für schnelle Kachel-Layouts. |

### 5. Einzelne „des Tages“-Seiten – Quellen, keine Konkurrenten

- Witz des Tages – https://www.witz-des-tages.de/ (täglich seit März 1998)
- Kalenderblatt von dpa, z. B. bei Zeitungen – https://zvw.de/mehr-nachrichten/kultur-unterhaltung/was-geschah-am-29-september_arid-1099712

Vor einer Übernahme von Inhalten Nutzungsrechte prüfen.

## Marktsignal: das klassische Genre schrumpft

- **Netvibes** hat den eigenständigen Webdienst am 2. Juni 2025 eingestellt – https://en.wikipedia.org/wiki/Netvibes
- **My Yahoo** war schon seit Dezember 2024 abgeschaltet – https://en.wikipedia.org/wiki/My_Yahoo
- **iGoogle** endete bereits 2013.

Ein Fachartikel fragt offen, ob personalisierte Startseiten sinnlos sind oder sich nur nicht gut zu Geld machen lassen: https://www.thepoint.online/netvibes-retiring-no-great-free-alternatives/

Folge für DAILY: Mit einem weiteren Widget-Baukasten gewinnt man wenig. Das Alleinstellungsmerkmal muss die **fertige, kuratierte Verdichtung** sein – DAILY ist nach dem Öffnen sofort nützlich, ohne Einrichtung.

## Namensnähe: daily.dev

- https://daily.dev/ – großes Angebot unter fast gleichem Namen: macht den neuen Browser-Tab zu einem personalisierten Nachrichten-Feed für Entwickler (Chrome-/Edge-Erweiterung, Apps).
- Andere Zielgruppe, aber Produktidee (Startseite im neuen Tab) und Name liegen nah beieinander.
- Vor einer Festlegung auf „DAILY“ als Marke: Markenrecherche beim DPMA (https://register.dpma.de/) bzw. EUIPO (https://euipo.europa.eu/). Keine Rechtsberatung – im Zweifel Anwalt fragen.

## Was DAILY eigenständig macht

1. **Eine Fläche ohne Scrollen**, Kacheln wachsen und schrumpfen (Entscheidungen 4), Raster passt sich der Kachelzahl an.
2. **Fertig statt Baukasten:** Tagesinhalte und sinnvolle Standardbelegung ab dem ersten Aufruf.
3. **Ohne Konto und ohne Nutzerdaten** außer dem Ort – Gegenentwurf zu den KI-Briefings, die Mail und Kalender brauchen.
4. **Deutscher Alltag:** Feiertage je Bundesland, Brückentage, Schulferien, Namenstage, amtliche DWD-Hinweise, DWD-Regenradar, Tankerkönig, EZB-Kurse.
5. **Ruhig statt Feed:** keine Nachrichten, keine Werbung, keine Endlosliste; „Wetterhinweise“ statt „Warnungen“.
6. **Transparenz:** Dienstblätter und Datenquellen-Seite zeigen Herkunft und Verarbeitung jeder Angabe.

## Einschätzung und Risiken (29.09.2026)

**Als Rogers eigenes Werkzeug:** Ziel aus Entscheidung 1 bereits erreicht. Die Wetterkachel ist detaillierter als die meisten Wetter-Apps.

**Als öffentliches Produkt:** möglich, aber eine Nische, und hart. Die eigentliche Konkurrenz sind nicht start.me und Co., sondern Gewohnheiten und Dinge, die schon da sind und nichts kosten:
- Sperrbildschirm und Widgets auf dem Handy (Wetter, Termine),
- die Browser-Startseite (Google, MSN in Edge),
- die ohnehin installierte Wetter-App.

Die Stärken (kein Konto, keine Werbung, keine Nachrichten, deutscher Alltag, ruhige Fläche) füllen die Lücke, die Netvibes und My Yahoo hinterlassen haben. Diese Kombination bietet derzeit niemand an.

### Worauf wir achten müssen

1. **Sofort nützlich, ohne Einrichtung.** Beim ersten Öffnen muss in fünf Sekunden klar sein, warum sich DAILY lohnt: Ort automatisch vorschlagen, gute Standardbelegung. Das unterscheidet DAILY von Baukästen, deren Nutzer die Lust verlieren.
2. **Wie Leute DAILY finden und behalten.** Kaum jemand ändert von Hand die Startseite seines Browsers. Realistisch sind eine Erweiterung für den neuen Tab (wie daily.dev) und die installierte PWA. Am Handy gibt es eine echte Grenze: Eine PWA kann keine Widgets auf dem Startbildschirm anlegen, und dort schauen die meisten nach dem Wetter. Früh klären, ob Handy oder Rechner das Hauptgerät für DAILY ist.
3. **Lizenzen der Datenquellen** – größtes verstecktes Risiko. Open-Meteo ist kostenlos nur für nicht kommerzielle Nutzung; auch bei Tankerkönig und anderen Quellen hängen die Bedingungen von der Nutzung ab. Sobald DAILY Geld einbringt (Spenden, Pro-Stufe, Sponsoring), können sich die Kosten grundlegend ändern. Vor der Veröffentlichung für jeden Dienst im Dienstblatt festhalten, was bei kommerzieller Nutzung gilt (Vorbild: `finanzdaten.md`).
4. **Finanzierung früh entscheiden.** Ohne Nutzerdaten und Werbung bleiben Spenden, eine kleine Pro-Stufe oder ein Sponsor je Kachel. Hängt direkt an Punkt 3 und am Wechsel von Vercel Hobby zu Pro.
5. **Tagesinhalte: Nachschub und Qualität.** Der Vorrat reicht bis 26.10.2026, danach wiederholen sich die Inhalte – treue Nutzer merken das sofort. Heikel sind die KI-Texte zu **Gesundheit** und **Beziehung**: Ein falscher Gesundheitstipp ist ein Haftungs- und Vertrauensproblem. Diese Rubriken brauchen eine Prüfung vor der Veröffentlichung oder sehr vorsichtige Inhalte.
6. **Weniger Kacheln, dafür alle auf dem Niveau des Wetters.** Zwölf ausgereifte Kacheln sind besser als zwanzig durchwachsene. „Deine Nutzung“ wie geplant auswerten (Entscheidung 9) und konsequent streichen.
7. **Ein-Personen-Projekt mit vielen fremden Quellen.** Jede Quelle kann ausfallen oder ihre Schnittstelle ändern. Statusanzeige und Dienstblätter helfen; trotzdem Zeit für die Pflege einplanen.
8. **Recht und Marke.** Auch mit nur dem Ort braucht die Veröffentlichung Impressum und Datenschutzerklärung (die IP-Adresse erreicht die Server-Funktionen). Die Markenfrage „DAILY“ vor Logo und Domain klären. Keine Rechtsberatung.

## Mögliche nächste Schritte

- **Test vor der Veröffentlichung:** 5–10 Leute aus Familie und Freundeskreis nutzen DAILY zwei Wochen lang. Entscheidende Kennzahl: Kommen sie nach einer Woche noch von sich aus zurück? Erfolgskriterium vorher festlegen, z. B. „mindestens die Hälfte öffnet DAILY an 4 von 7 Tagen“. Erst wenn das klappt, lohnt der Aufwand für Recht, Lizenzen und Finanzierung.
- Markenrecherche „DAILY“ (siehe oben).
- Die Ideenliste enthält eine „KI-Tageszusammenfassung“. Sie wäre ein Briefing als Kachel – öffentlich nur ohne Nutzerdaten und ohne Nachrichten denkbar (Entscheidungen 0 und 7).

## Quellen

- start.me – Einführung: https://support.start.me/en/articles/9182794-introduction-to-start-me
- start.me – Chrome Web Store: https://chromewebstore.google.com/detail/new-tab-page-by-startme/cfmnkhhioonhiehehedmnjibmampjiab
- igHome in 2026 und Alternativen (Abunch): https://abunch.io/blog/ighome-alternative
- Tab Widgets – Chrome Web Store: https://chromewebstore.google.com/detail/tab-widgets-custom-new-ta/ejnndgifkmlldcdlifjaeanhjegoafcl
- MSN als Startseite: https://www.startseitefestlegen.de/msn/
- Windows 11 Widgets (tippsling): https://tippsling.de/windows-11-boersenticker-aktien-widget-hinzufuegen-so-gehts/
- ChatGPT Pulse (The Rundown): https://www.therundown.ai/p/chatgpt-gets-proactive-with-pulse
- Google CC (Unite.AI): https://www.unite.ai/google-launches-cc-an-ai-agent-that-plans-your-day-using-gmail-calendar-and-drive/
- Netvibes-Ende (Medium): https://medium.com/turn-on-press-play/netvibes-rides-into-the-sunset-alternatives-do-not-impress-39c9282692b6
- daily.dev – Chrome Web Store: https://chromewebstore.google.com/detail/dailydev-developer-news-d/jlmpjdjjbgclbocgajdjefcidcncaied
