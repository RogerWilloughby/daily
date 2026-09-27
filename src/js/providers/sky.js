// „Himmel“: Tageslänge, Sonne, Mondphase, Sternschnuppen – ohne Netz aus dem Ort berechnet.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { hm } from '../core/util.js';
import { sunTimes, moon, nextMeteor } from '../lib/astro.js';

let info = null;
const dayFmt = t => new Date(t).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'numeric' });
const dur = ms => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

export async function load() {
  const { lat, lon, name } = settings.place, now = Date.now();
  const s = sunTimes(now, lat, lon), s0 = sunTimes(now - 864e5, lat, lon);
  const mo = moon(now), met = nextMeteor(now);
  const len = s.rise && s.set ? s.set - s.rise : null;
  const diff = len && s0.rise ? Math.round((len - (s0.set - s0.rise)) / 60000) : 0;
  info = { s, mo, met, len, diff, name };
  const pct = Math.round(mo.illum * 100);
  const nextBig = mo.nextFull < mo.nextNew ? ['Vollmond', mo.nextFull] : ['Neumond', mo.nextNew];
  const rows = [
    ['Ort', name],
    ['Sonnenaufgang', s.rise ? hm(new Date(s.rise).toISOString()) + ' Uhr' : '–'],
    ['Sonnenuntergang', s.set ? hm(new Date(s.set).toISOString()) + ' Uhr' : '–'],
    ['Tageslänge', len ? `${dur(len)} (${diff === 0 ? 'wie gestern' : `${Math.abs(diff)} min ${diff < 0 ? 'kürzer' : 'länger'} als gestern`})` : '–'],
    ['Mond', `${mo.name}, ${pct} % beleuchtet`],
    ['Nächster Vollmond', dayFmt(mo.nextFull)],
    ['Nächster Neumond', dayFmt(mo.nextNew)],
    ['Sternschnuppen', `${met.name}: Maximum ${dayFmt(met.date)}, bis zu ${met.rate} pro Stunde bei dunklem Himmel`],
    ['Hinweis', 'Berechnet, Genauigkeit etwa ±2 Minuten']
  ];
  set('sky', {
    state: 'local', m: mo.name, ms: pct + ' %',
    x: [len && `Tag ${dur(len)}${diff ? ` (${diff > 0 ? '+' : '−'}${Math.abs(diff)} min)` : ''}`, mo.name === nextBig[0] ? null : `${nextBig[0]} ${dayFmt(nextBig[1])}`, `${met.name} ${dayFmt(met.date)}`].filter(Boolean).join(' · '),
    rows
  });
}

addAnswer(/mond|sonnenaufgang|sonnenuntergang|sonne|sternschnuppe|tageslänge/i, q => {
  if (!info) return null;
  const { s, mo, met, len, diff } = info;
  if (/mond/i.test(q)) return `${mo.name}, ${Math.round(mo.illum * 100)} % beleuchtet. Nächster Vollmond ${dayFmt(mo.nextFull)}, Neumond ${dayFmt(mo.nextNew)}.`;
  if (/stern/i.test(q)) return `Nächste Sternschnuppen: ${met.name}, Maximum ${dayFmt(met.date)}, bis zu ${met.rate} pro Stunde.`;
  return `Sonne heute: ${s.rise ? hm(new Date(s.rise).toISOString()) : '–'} bis ${s.set ? hm(new Date(s.set).toISOString()) : '–'} Uhr${len ? `, Tag ${dur(len)} (${Math.abs(diff)} min ${diff < 0 ? 'kürzer' : 'länger'} als gestern)` : ''}.`;
});

export default { id: 'sky', name: 'Himmel', local: true, every: 30 * 60e3, load };
