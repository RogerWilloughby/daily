// DAILY – Kalender: bekommt die privaten iCal-Links aus den DAILY-Einstellungen
// (POST, werden nicht gespeichert) oder ersatzweise aus der Vercel-Umgebungsvariable
// CALENDAR_ICS_URL und liefert die Termine von heute bis +7 Tage. Links nie in den Code!
const ical = require('node-ical');

const TZ = 'Europe/Berlin';
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/i;
// Ganztägige Termine legt node-ical in der Zeitzone des Servers an → deren lokales Datum nehmen.
const localKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayKey = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  // Links kommen aus den DAILY-Einstellungen (POST {urls:[...]}); Ersatz: Umgebungsvariable.
  let urls = [];
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    if (body && Array.isArray(body.urls)) urls = body.urls;
  }
  if (!urls.length) urls = (process.env.CALENDAR_ICS_URL || '').split(/[\s,]+/);
  urls = urls.map(u => String(u).trim().replace(/^webcal:/i, 'https:'))
    .filter(u => { try { const h = new URL(u); return h.protocol === 'https:' && !PRIVATE_HOST.test(h.hostname); } catch (e) { return false; } })
    .slice(0, 5);
  if (!urls.length) return res.status(200).json({ configured: false, events: [] });

  const now = new Date();
  const today = dayKey(now);
  const from = new Date(now.getTime() - 36 * 3600e3);
  const to = new Date(now.getTime() + 8 * 24 * 3600e3);
  const events = [];
  let failed = 0;

  await Promise.all(urls.map(async url => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = ical.sync.parseICS(await r.text());
      for (const ev of Object.values(data)) {
        if (!ev || ev.type !== 'VEVENT' || ev.recurrenceid) continue;
        if (ev.status === 'CANCELLED') continue;
        let instances = [];
        try { instances = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true }); } catch (e) { continue; }
        for (const i of instances) {
          const allDay = !!i.isFullDay;
          const day = allDay ? localKey(i.start) : dayKey(i.start);
          if (day < today) continue;
          events.push({
            title: String(i.summary || (ev.summary && ev.summary.val) || ev.summary || 'Termin'),
            start: i.start.toISOString(),
            end: i.end ? i.end.toISOString() : null,
            allDay,
            day
          });
        }
      }
    } catch (e) { failed++; }
  }));

  events.sort((a, b) => a.day.localeCompare(b.day) || (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
  res.status(200).json({ configured: true, failed, today, events: events.slice(0, 60) });
};
