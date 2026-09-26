// DAILY – „An diesem Tag“ aus der deutschen Wikipedia (Wikimedia-Feed, CC BY-SA 4.0).
// Lexikon-Fakten mit Link zur Quelle, keine eigenen Texte.
const { getJson, send } = require('./_lib/http');

function berlinParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', month: '2-digit', day: '2-digit' }).formatToParts(d);
  return { mm: p.find(x => x.type === 'month').value, dd: p.find(x => x.type === 'day').value };
}

function mapEvents(list) {
  return (list || []).filter(e => e && e.text && e.year).map(e => {
    const page = (e.pages || [])[0];
    return { year: e.year, text: String(e.text).replace(/\s+/g, ' ').trim(), link: page && page.content_urls && page.content_urls.desktop ? page.content_urls.desktop.page : null };
  }).sort((a, b) => b.year - a.year);
}

async function handler(req, res) {
  const { mm, dd } = berlinParts();
  try {
    // zwei gleichwertige Adressen desselben Wikimedia-Dienstes; die zweite dient als Ausweich
    const feed = async kind => {
      try { return await getJson(`https://api.wikimedia.org/feed/v1/wikipedia/de/onthisday/${kind}/${mm}/${dd}`); }
      catch (e) { return getJson(`https://de.wikipedia.org/api/rest_v1/feed/onthisday/${kind}/${mm}/${dd}`); }
    };
    let events = mapEvents((await feed('selected')).selected);
    if (events.length < 3) {
      const all = await feed('events').catch(() => null);
      if (all) events = events.concat(mapEvents(all.events)).slice(0, 12);
    }
    send(res, { date: `${mm}-${dd}`, events: events.slice(0, 8), source: 'Wikipedia (CC BY-SA 4.0)' }, 3600);
  } catch (e) {
    send(res, { date: `${mm}-${dd}`, events: [], error: e.message }, 0, 502);
  }
}

module.exports = handler;
module.exports.mapEvents = mapEvents;
