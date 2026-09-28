# DAILY – Recherche: Finanzdaten für die Geld-Kachel (Stand 28.09.2026)

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
| Aktien/Indizes 15 Min. verzögert | lizenzierte Anbieter | nur mit Börsenlizenz | ab ca. 250 $ pro Monat (Beispiel USA) | Lizenz- und Meldepflichten |
| **Aktien/Indizes Schlusskurs Vortag** | Anbieter von Tagesdaten | **ja, ohne Börsenlizenz (USA)** | nur Anbieterkosten | Vortagesdaten gelten als „historisch“; für Xetra/Deutsche Börse noch prüfen |
| Kryptowährungen | CoinGecko | Gratis-Plan (Demo): nicht kommerziell, Quellenangabe Pflicht | 0 $ (10.000 Abrufe/Monat, 100/Min.); kommerziell ab ca. 35 $/Monat | mit Server-Cache (z. B. alle 5 Min.) reichen die Abrufe |
| Eigene Werte (Depot, Beobachtungsliste) | Alpha Vantage, Finnhub u. a. mit persönlichem Schlüssel | nein – nur privat | kostenlos (Gratis-Schlüssel) | wie die Termine: nur im privaten Betrieb (`DAILY_PRIVATE=1`) |

## Vorschlag für die Geld-Kachel

- **Öffentlich:** EZB-Wechselkurse und Leitzins; optional DAX und Co. als Schlusskurs des letzten Handelstags (Lizenzlage für deutsche Börsen vorher klären).
- **Privat zusätzlich:** eigene Werte mit aktuellen Kursen über einen persönlichen Schlüssel.
- **Krypto:** öffentlich erst mit Bezahl-Plan rechtlich sauber; bis dahin nur privat.
- Keine Anlageempfehlungen (siehe `../recht/checkliste.md`).

## Offene Prüfpunkte vor der Umsetzung

- ~~EZB: Bedingungen zur Weiterverwendung~~ – geklärt 28.09.2026: alle öffentlichen ESZB-Statistiken kostenlos, auch kommerziell, mit Quellenangabe („Quelle: EZB“) und ohne Veränderung der Werte; Referenzkurse nur zur Information, nicht für Geschäfte. Umgesetzt im Dienst `finanzen` (App 0.22.0). Quelle: [EZB – Policy regarding the reuse of ESCB statistics](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html)
- Deutsche Börse/Xetra: Dürfen Schlusskurse vom Vortag ohne Lizenz öffentlich gezeigt werden? Welche Anbieter liefern sie mit Weitergaberecht?
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
