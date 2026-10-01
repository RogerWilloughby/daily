# DAILY – Recherche: Finanzdaten für die Geld-Kachel (Stand 28.09.2026, ergänzt 01.10.2026)

Grundlage für den späteren Finanzdienst (`waehrungen`, `krypto`, `kurse`, siehe `../konzept/dienste-katalog.md`, Abschnitt 4).
Vor der Umsetzung sind die unter „Offene Prüfpunkte“ genannten Bedingungen nachzulesen – Konditionen ändern sich.

## Warum nicht Yahoo Finance (öffentlich)?

1. **Keine offizielle Schnittstelle.** Yahoo hat seine Finanz-API 2017 eingestellt. Werkzeuge wie `yfinance` nutzen interne Adressen der Yahoo-Webseite, die sich jederzeit ändern oder gesperrt werden können.
2. **Nutzungsbedingungen.** Die Daten sind nur zur persönlichen Ansicht gedacht; automatisches Abrufen (Scraping) und Weitergabe, erst recht in einem eigenen öffentlichen Angebot, sind untersagt. Auch die `yfinance`-Entwickler weisen darauf hin, dass das Werkzeug nur für private Zwecke gedacht ist.
3. **Fremde Lizenzen.** Yahoo kauft Kurse bei Börsen und Datenanbietern ein; diese Lizenzen erlauben nur die Anzeige auf Yahoos eigenen Seiten.

**Folge:** Privat (Rogers Betrieb) eine Grauzone mit Ausfallrisiko; öffentlich (Ziel 10 Mio. Aufrufe/Tag) ausgeschlossen.

## Alternativen nach Datenart

| Datenart | Quelle | Öffentlich nutzbar? | Kosten | Bedingungen / Hinweise |
|---|---|---|---|---|
| Wechselkurse (≈ 30 Währungen gegen €) | EZB-Referenzkurse | ja (vermutlich, mit Quellenangabe – prüfen) | kostenlos | 1× je Werktag gegen 16 Uhr MEZ; ideal für Cache (1 Abruf/Tag für alle Nutzer) |
| Leitzinsen | EZB (Data Portal) | ja (wie oben) | kostenlos | ändert sich selten |
| Aktien/Indizes Echtzeit | Börsen bzw. lizenzierte Anbieter | nur mit Börsenlizenz | oft fünfstellig pro Monat | für DAILY nicht sinnvoll |
| Aktien/Indizes 15 Min. verzögert | lizenzierte Anbieter | USA: nur mit Börsenlizenz; **Deutsche Börse: kostenlos, solange nicht kommerzialisiert** (siehe unten) | ab ca. 250 $ pro Monat (Beispiel USA) | Lizenz- und Meldepflichten; Lieferant mit Weitergaberecht nötig |
| **Aktien/Indizes Schlusskurs Vortag** | Anbieter von Tagesdaten | **ja, ohne Börsenlizenz (USA)** | nur Anbieterkosten | Vortagesdaten gelten als „historisch“; für Xetra/Deutsche Börse noch prüfen |
| Kryptowährungen | CoinGecko | Gratis-Plan (Demo): nicht kommerziell, Quellenangabe Pflicht | 0 $ (10.000 Abrufe/Monat, 100/Min.); kommerziell ab ca. 35 $/Monat | mit Server-Cache (z. B. alle 5 Min.) reichen die Abrufe |
| Kryptowährungen | CoinMarketCap (Basic) | nur „personal use“ | 0 $ (10.000 Credits/Monat); kommerziell „Startup“ 79 $/Monat | Stand 01.10.2026 |
| Kryptowährungen | CoinPaprika | Gratis-Plan laut Vergleich nur privat | 0 $ (20.000 Abrufe/Monat, ohne Schlüssel); ab 99 $/Monat | Bedingungen im Wortlaut noch prüfen |
| Kryptowährungen | Börsen-Schnittstellen (Kraken, Binance u. a.) | nach den Bedingungen der jeweiligen Börse – offen | 0 $, keine feste Grenze | Kurs einer einzelnen Börse, kein Marktdurchschnitt |
| Eigene Werte (Depot, Beobachtungsliste) | Alpha Vantage, Finnhub u. a. mit persönlichem Schlüssel | nein – nur privat | kostenlos (Gratis-Schlüssel) | wie die Termine: nur im privaten Betrieb (`DAILY_PRIVATE=1`) |

## Ergänzung 01.10.2026

**Krypto – Abrufe:** Kurse sind für alle Nutzer gleich; zentral gecacht (alle 5 Min.) sind es ≈ 9.000 Abrufe/Monat, unabhängig von der Nutzerzahl. Die Gratis-Grenzen reichen also – es fehlt nur das Recht zur öffentlichen bzw. kommerziellen Nutzung. Für eine öffentliche, werbefreie Seite ist CoinGecko Demo mit Quellenangabe der einfachste Weg; sobald DAILY Einnahmen hat, ein Bezahl-Plan.

**Deutsche Börse – verzögerte Daten** (Market Data Policy Guidelines and FAQ, Abschnitt 10, Version 2_6 vom 14.03.2024):
- „DBAG makes available Market Data […] 15 minutes after its initial creation by all regulated exchanges operated by Deutsche Börse Group (including FWB, Eurex Deutschland or EEX) ("Delayed Data") free of charge“.
- „A free of charge usage right is only granted if the User who is accessing and using Delayed Data […] does not commercialize the Delayed Data.“
- Kommerzialisierung (nicht abschließend): Weitergabe an Dritte gegen Gebühr („including a general fee for accessing its services“) und Verkauf von Mehrwertdiensten.
- Folge: Eine kostenlose Seite ohne Zugangsgebühr dürfte verzögerte Xetra-Kurse zeigen. Offen bleiben Werbung, die technische Lieferung (Anbieter mit Weitergaberecht) und die Indexdaten (DAX: Deutsche Börse bzw. STOXX/Qontigo, eigene Indexlizenz möglich).

**Gold:** Quelle offen – LBMA-Preis lizenzpflichtig; Bundesbank-Statistik frei, aber nicht täglich aktuell.

## Vorschlag für die Geld-Kachel

- **Öffentlich:** EZB-Wechselkurse und Leitzins; optional DAX und Co. als Schlusskurs des letzten Handelstags (Lizenzlage für deutsche Börsen vorher klären).
- **Privat zusätzlich:** eigene Werte mit aktuellen Kursen über einen persönlichen Schlüssel.
- **Krypto:** öffentlich über CoinGecko Demo mit Quellenangabe, solange DAILY nicht kommerziell ist (ein zentraler Abruf je 5 Min. für alle); mit Einnahmen Bezahl-Plan.
- **Aktien/Indizes öffentlich:** zunächst nur Schlusskurs des Vortags, sobald ein Anbieter mit Weitergaberecht gefunden ist; Echtzeit bzw. 15 Min. verzögert erst mit geklärter Lizenz.
- Keine Anlageempfehlungen (siehe `../recht/checkliste.md`).

## Offene Prüfpunkte vor der Umsetzung

- ~~EZB: Bedingungen zur Weiterverwendung~~ – geklärt 28.09.2026: alle öffentlichen ESZB-Statistiken kostenlos, auch kommerziell, mit Quellenangabe („Quelle: EZB“) und ohne Veränderung der Werte; Referenzkurse nur zur Information, nicht für Geschäfte. Umgesetzt im Dienst `finanzen` (App 0.22.0). Quelle: [EZB – Policy regarding the reuse of ESCB statistics](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html)
- Deutsche Börse/Xetra: ~~Lizenz für verzögerte Daten~~ – geklärt 01.10.2026: 15 Min. verzögert kostenlos, solange nicht kommerzialisiert (siehe Ergänzung). Offen: Zählt Werbung als Kommerzialisierung? Indexlizenz DAX/STOXX? Welche Anbieter liefern Schlusskurse bzw. verzögerte Kurse mit Weitergaberecht?
- Krypto-Börsen-Schnittstellen (Kraken, Binance u. a.): Bedingungen für die Anzeige auf fremden Seiten.
- Goldpreis: freie Quelle mit täglichem Wert.
- Alpha Vantage / Finnhub: aktuelle Gratis-Grenzen und Bedingungen für die private Nutzung.
- CoinGecko: Wortlaut der API-Bedingungen zur Quellenangabe.

## Quellen

- [Yahoo Developer API Terms of Use](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html)
- [yfinance auf PyPI](https://pypi.org/project/yfinance/0.2.39)
- [Yahoo Finance API: Complete Guide + Best Alternatives (2026), MarketXLS](https://marketxls.com/blog/yahoo-finance-api-ultimate-guide)
- [Why Enterprises Move from Yahoo Finance Scraping to Managed Data Feeds (2026), PromptCloud](https://www.promptcloud.com/blog/scrape-yahoo-finance/)
- [Stock Market Data Licensing: How To Display Stock Prices Legally, marketdata.app](https://www.marketdata.app/education/stocks/stock-market-data-licensing/)
- [CoinGecko API Pricing](https://www.coingecko.com/en/api/pricing)
- [CoinGecko API Terms of Service](https://www.coingecko.com/en/api_terms)
- [EZB: Euro-Referenzkurse](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)
- [ECB Data Portal: Exchange rates](https://data.ecb.europa.eu/key-figures/ecb-interest-rates-and-exchange-rates/exchange-rates)
- [Alpha Vantage](https://www.alphavantage.co/)
- [Best Free Financial Data APIs (2026), Find My Moat](https://www.findmymoat.com/list/free/financial-data-apis)
- [Deutsche Börse – Market Data Policy Guidelines and FAQ (PDF)](https://www.mds.deutsche-boerse.com/resource/blob/3134034/dac167f9f376e95323f12c42db14e173/data/Market-Data-Policy-Guidelines-and-FAQ_V2_2.pdf)
- [CoinMarketCap API Pricing](https://coinmarketcap.com/api/pricing/)
- [CoinMarketCap: Free Crypto API Tiers in 2026](https://coinmarketcap.com/academy/article/best-free-crypto-api-in-2026-free-tier-comparison)
- [CoinPaprika API – Einführung](https://docs.coinpaprika.com/get-started/api-rest-introduction)
