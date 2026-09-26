// DAILY – Geld: Indizes, Krypto, Währung und Gold als reine Kurse (keine Empfehlungen).
// Quelle: Yahoo-Finance-Chartdaten (nur private Nutzung). Werte hier anpassen:
const SYMBOLS = [
  { id: 'dax',   name: 'DAX',                 symbol: '^GDAXI',   unit: 'Pkt' },
  { id: 'sp500', name: 'S&P 500',             symbol: '^GSPC',    unit: 'Pkt' },
  { id: 'world', name: 'MSCI World (ETF)',    symbol: 'IWDA.AS',  unit: 'EUR' },
  { id: 'btc',   name: 'Bitcoin',             symbol: 'BTC-EUR',  unit: 'EUR' },
  { id: 'eth',   name: 'Ethereum',            symbol: 'ETH-EUR',  unit: 'EUR' },
  { id: 'eurusd',name: 'Euro/US-Dollar',      symbol: 'EURUSD=X', unit: 'USD' },
  { id: 'gold',  name: 'Gold (Unze)',         symbol: 'GC=F',     unit: 'USD' }
];

async function quote(s) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s.symbol) + '?range=5d&interval=1d';
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (DAILY privat)' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m || typeof m.regularMarketPrice !== 'number') throw new Error('keine Kursdaten');
  const prev = typeof m.chartPreviousClose === 'number' ? m.chartPreviousClose : m.previousClose;
  return {
    id: s.id, name: s.name, unit: s.unit, ok: true,
    price: m.regularMarketPrice,
    change: typeof prev === 'number' && prev ? (m.regularMarketPrice - prev) / prev * 100 : null,
    time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null
  };
}

module.exports = async (req, res) => {
  const items = await Promise.all(SYMBOLS.map(s => quote(s).catch(e => ({ id: s.id, name: s.name, unit: s.unit, ok: false, error: String((e && e.message) || e) }))));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.status(200).json({ updated: new Date().toISOString(), items });
};
