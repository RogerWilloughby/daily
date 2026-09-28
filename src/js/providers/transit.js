// Abfahrten über /api/transit (VVO, Dresden und Umgebung) an der Haltestelle aus den Einstellungen.
import { set } from '../core/board.js';
import { settings, saveSettings } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { hm, getJson } from '../core/util.js';

let data = null;
const mins = iso => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
const inTxt = iso => { const m = mins(iso); return m === 0 ? 'jetzt' : `in ${m} min`; };
// „Tram 1“, „Bus 62“, „S1“ – Verkehrsmittel vor die Liniennummer
const lineLabel = d => /^[A-Z]/.test(d.line) ? d.line : /bus/i.test(d.mot) ? `Bus ${d.line}` : /tram/i.test(d.mot) ? `Tram ${d.line}` : d.line;

export async function load() {
  const j = await getJson('/api/transit?stop=' + encodeURIComponent(settings.stop || 'Postplatz'));
  if (!j.found) {
    data = null;
    set('transit', { state: 'off', title: 'Abfahrten', m: 'Haltestelle wählen', ms: '–', x: `Haltestelle „${settings.stop}“ wurde nicht gefunden. In den Einstellungen der Kachel (Zahnrad) anpassen.`,
      rows: [['Gesucht', settings.stop], ['Gebiet', 'Verkehrsverbund Oberelbe (Dresden und Umgebung)']] });
    return;
  }
  data = j;
  const deps = j.departures.filter(d => Date.parse(d.time) > Date.now() - 60000);
  const first = deps[0];
  const rows = deps.slice(0, 10).map(d => [`${hm(d.time)}${d.delay > 0 ? ` (+${d.delay})` : ''}`, `${lineLabel(d)} → ${d.direction}${d.platform ? ' · ' + d.platform : ''}`]);
  if (!rows.length) rows.push(['Abfahrten', 'in der nächsten Zeit keine']);
  rows.push(['Quelle', 'VVO · Echtzeit, soweit verfügbar']);
  set('transit', {
    state: 'live', title: j.stop.name,
    m: first ? `${lineLabel(first)} ${inTxt(first.time)}` : 'Keine Abfahrt',
    ms: first ? (mins(first.time) ? `${mins(first.time)} min` : 'jetzt') : '–',
    x: deps.slice(0, 3).map(d => `${lineLabel(d)} → ${d.direction} ${inTxt(d.time)}`).join(' · ') || 'Gerade keine Abfahrten.',
    rows
  });
}

addAnswer(/bus|bahn|tram|straßenbahn|strassenbahn|abfahrt|haltestelle|öpnv|oepnv|fahren/i, () => {
  if (!data) return 'Die Abfahrten sind gerade nicht verfügbar.';
  const deps = data.departures.filter(d => Date.parse(d.time) > Date.now() - 60000).slice(0, 4);
  return deps.length ? `${data.stop.name}: ` + deps.map(d => `${lineLabel(d)} nach ${d.direction} ${inTxt(d.time)}`).join(', ') + '.' : `${data.stop.name}: gerade keine Abfahrten.`;
});

// Einstellungen der Kachel (Zahnrad-Reiter)
kachelEinstellungen('transit', {
  felder: () => [{ typ: 'text', key: 'stop', label: 'Haltestelle', wert: settings.stop || '', platzhalter: 'z. B. Postplatz', hilfe: 'Verkehrsverbund Oberelbe (Dresden und Umgebung).' }],
  speichern: w => saveSettings({ stop: w.stop.trim() || 'Postplatz' })
});

export default { id: 'transit', name: 'Abfahrten', every: 60e3, load };
