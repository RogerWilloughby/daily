// DAILY – Seitensymbole für die Kachel „Meine Seiten“: GET /api/icon?s=<id> → Bild (PNG/ICO/…).
// Nur Seiten aus der festen Auswahl (src/content/seiten.json) – keine beliebigen Adressen (schützt den Server vor Missbrauch).
// Holt das Symbol direkt von der Seite (Rogers Entscheidung 01.10.2026, kein fremder Symboldienst):
//   1. /apple-touch-icon.png  2. im HTML der Startseite angegebenes Symbol (apple-touch-icon bzw. icon, das größte)  3. /favicon.ico
// Die Seite sieht nur DAILY, nicht die IP der Nutzer. CDN und Browser halten das Symbol 30 Tage, „kein Symbol“ 1 Tag.
// Kein Dienst im Format daily/1 (die Antwort ist ein Bild).
const KATALOG = require('../src/content/seiten.json');
const SEITEN = Object.fromEntries(KATALOG.kategorien.flatMap(k => k.seiten).map(s => [s.id, s]));
const UA = 'Mozilla/5.0 (compatible; DAILY-Seitensymbol; https://github.com/RogerWilloughby/daily)';
const HALTEN = 30 * 86400, NICHTS = 86400, MAX_BYTES = 300 * 1024, TIMEOUT = 5000;

async function hole(url, art) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: art === 'html' ? 'text/html' : 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    const typ = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return null;
    if (art === 'html') return { typ, buf: buf.subarray(0, 2 * MAX_BYTES), url: r.url || url };   // nur der Anfang (Kopf) wird gebraucht
    return buf.length > MAX_BYTES ? null : { typ, buf, url: r.url || url };
  } catch (e) { return null; }
}
const istBild = x => !!x && (/^image\//.test(x.typ) || (x.typ === 'application/octet-stream' && /\.(ico|png)$/i.test(x.url)));

// Symbol-Angaben aus dem HTML: <link rel="apple-touch-icon" href="…" sizes="180x180"> u. Ä. – das größte zuerst (rein, testbar)
function symboleAusHtml(html, basis) {
  const out = [];
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0], rel = (tag.match(/\brel\s*=\s*["']?([^"'>]+)/i) || [])[1] || '', href = (tag.match(/\bhref\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (!href || !/(^|\s)(apple-touch-icon(-precomposed)?|icon|shortcut icon)(\s|$)/i.test(rel)) continue;
    const groesse = +((tag.match(/\bsizes\s*=\s*["']?(\d+)x\d+/i) || [])[1] || (/apple/i.test(rel) ? 180 : 16));
    if (/\.svg(\?|$)/i.test(href) && !/apple/i.test(rel)) continue;   // SVG-Symbole oft einfarbig/maskiert – lieber PNG
    try { out.push({ url: new URL(href.replace(/&amp;/g, '&'), basis).href, groesse }); } catch (e) { /* ungültig */ }
  }
  return out.filter(x => /^https:/.test(x.url)).sort((a, b) => b.groesse - a.groesse);
}

async function symbol(seite) {
  const start = new URL(seite.url), wurzel = `${start.protocol}//${start.host}`;
  const a = await hole(`${wurzel}/apple-touch-icon.png`);
  if (istBild(a)) return a;
  const html = await hole(seite.url, 'html');
  if (html) for (const k of symboleAusHtml(html.buf.toString('utf8'), html.url).slice(0, 3)) { const b = await hole(k.url); if (istBild(b)) return b; }
  const f = await hole(`${wurzel}/favicon.ico`);
  return istBild(f) ? f : null;
}

module.exports = async function handler(req, res) {
  const id = String((req.query || {}).s || ''), seite = SEITEN[id];
  const ende = (status, typ, inhalt, sek) => {
    res.statusCode = status; res.setHeader('content-type', typ);
    res.setHeader('Cache-Control', sek > 0 ? `public, max-age=${sek}, s-maxage=${sek}` : 'no-store');
    res.end(inhalt);
  };
  if (req.method !== 'GET') return ende(405, 'text/plain; charset=utf-8', 'Nur GET', 0);
  if (!seite) return ende(400, 'text/plain; charset=utf-8', 'Unbekannte Seite', 0);
  const b = await symbol(seite);
  if (!b) return ende(404, 'text/plain; charset=utf-8', 'Kein Symbol', NICHTS);
  ende(200, /^image\//.test(b.typ) ? b.typ : (/\.png$/i.test(b.url) ? 'image/png' : 'image/x-icon'), b.buf, HALTEN);
};
module.exports.SEITEN = SEITEN;
module.exports.symboleAusHtml = symboleAusHtml;
