// DAILY – Schlagzeilen: holt die RSS/Atom-Feeds serverseitig und liefert
// Originalüberschriften + Link als JSON. Keine eigene Auswahl, Gewichtung
// oder Zusammenfassung (siehe docs/konzept/entscheidungen.md, Punkt 7).
// Quellen hier anpassen:
const FEEDS = [
  { name: 'Tagesschau', url: 'https://www.tagesschau.de/index~rss2.xml' },
  { name: 'MDR Sachsen', url: 'https://www.mdr.de/nachrichten/sachsen/index-rss.xml' },
  { name: 'heise', url: 'https://www.heise.de/rss/heise-atom.xml' }
];

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decode(m[1]) : '';
}

function toIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString();
}

function parse(xml, source) {
  const items = [];
  const re = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < 15) {
    const b = m[0];
    let link = tag(b, 'link');
    if (!/^https?:\/\//.test(link)) {
      const l = b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || b.match(/<link[^>]*href="([^"]+)"/i);
      link = l ? l[1].replace(/&amp;/g, '&') : '';
    }
    const title = tag(b, 'title');
    const date = toIso(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date'));
    if (title && /^https?:\/\//.test(link)) items.push({ source, title, link, date });
  }
  return items;
}

module.exports = async (req, res) => {
  const results = await Promise.all(FEEDS.map(async f => {
    try {
      const r = await fetch(f.url, {
        headers: { 'user-agent': 'DAILY/0.1 (privater Feed-Reader)' },
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { name: f.name, ok: true, items: parse(await r.text(), f.name) };
    } catch (e) {
      return { name: f.name, ok: false, error: String((e && e.message) || e), items: [] };
    }
  }));
  const items = results.flatMap(r => r.items)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 30);
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  res.status(200).json({
    updated: new Date().toISOString(),
    sources: results.map(({ name, ok, error, items }) => ({ name, ok, error, count: items.length })),
    items
  });
};

module.exports.parse = parse;
