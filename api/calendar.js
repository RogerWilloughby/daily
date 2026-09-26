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
  const errors = []; // verständliche Fehlermeldung je Kalender (ohne den Link selbst)

  await Promise.all(urls.map(async (url, idx) => {
    try {
      let r;
      try {
        r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'DAILY/0.1 (privater Kalender-Abruf)' } });
      } catch (e) {
        throw new Error(e && e.name === 'TimeoutError' ? 'keine Antwort innerhalb von 10 Sekunden' : 'Server nicht erreichbar');
      }
      if (r.status === 404) throw new Error('Link nicht gefunden (404) – ist es die „Privatadresse im iCal-Format“?');
      if (r.status === 401 || r.status === 403) throw new Error('Zugriff verweigert (' + r.status + ') – Link evtl. zurückgesetzt oder nicht öffentlich');
      if (!r.ok) throw new Error('Fehler vom Kalender-Server (HTTP ' + r.status + ')');
      const text = await r.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Der Link liefert keine Kalenderdatei, sondern eine Webseite – bitte den iCal-Link (endet meist auf .ics) nehmen');
      let data;
      try { data = ical.sync.parseICS(text); } catch (e) { throw new Error('Kalenderdatei konnte nicht gelesen werden'); }
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
    } catch (e) { failed++; errors.push({ kalender: idx + 1, fehler: String((e && e.message) || e) }); }
  }));

  events.sort((a, b) => a.day.localeCompare(b.day) || (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
  errors.sort((a, b) => a.kalender - b.kalender);
  res.status(200).json({ configured: true, failed, errors, today, events: events.slice(0, 60) });
};
