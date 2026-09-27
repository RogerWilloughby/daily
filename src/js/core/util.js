// Kleine Helfer ohne Abhängigkeiten.

export const TZ = 'Europe/Berlin';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3"/>',
  money: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  pair: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 15c3 0 6 2 6 5"/>',
  food: '<path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 3c-2 2-2 6 0 8v10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 12-3h2v3l2 1v3h-2a7 6 0 0 1-3 3v2h-3v-1.5a8 8 0 0 1-2 0V20H8v-2a6 6 0 0 1-3-5zM15 10h.01"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  tram: '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M9 20l-2 2M15 20l2 2M9 1h6M12 1v3"/><circle cx="9" cy="14" r=".5"/><circle cx="15" cy="14" r=".5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01" stroke-width="3"/>',
  bars: '<path d="M5 20V11M12 20V4M19 20v-7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10zM12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5l-2.5 4M8 10L3.5 8.5"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7.5 5l9 4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  warn: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 2v7a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'
};
export const icon = (k, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

// Wetter-Symbole für die Kennzahl (WMO-Code → Symbol)
const GLYPHS = {
  clear: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2 6 6M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  partly: '<path d="M8 3.5v1.5M3.5 8H5M4.8 4.8l1 1M12 5.6a4 4 0 0 0-6.3 4.8"/><path d="M7 19h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.4 1.6A3.2 3.2 0 0 0 7 19z"/>',
  cloud: '<path d="M6.5 19h11a4.5 4.5 0 0 0 .7-8.9A6 6 0 0 0 6.6 11.4 3.8 3.8 0 0 0 6.5 19z"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
  rain: '<path d="M6.5 15h11a4.5 4.5 0 0 0 .7-8.9A6 6 0 0 0 6.6 7.4 3.8 3.8 0 0 0 6.5 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M6.5 14h11a4.5 4.5 0 0 0 .7-8.9A6 6 0 0 0 6.6 6.4 3.8 3.8 0 0 0 6.5 14zM8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01" stroke-width="2.4"/>',
  storm: '<path d="M6.5 14h11a4.5 4.5 0 0 0 .7-8.9A6 6 0 0 0 6.6 6.4 3.8 3.8 0 0 0 6.5 14zM13 14l-3 4h4l-3 4"/>'
};
export const glyph = k => GLYPHS[k] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[k]}</svg>` : '';

// Zeilen „Bezeichnung – Wert“; Wert kann Text oder {text, href} sein
export const rows = d => '<dl>' + (d || []).map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${
  v && typeof v === 'object' ? `<a href="${esc(v.href)}" target="_blank" rel="noopener">${esc(v.text)}</a>` : esc(v)
}</dd></div>`).join('') + '</dl>';

export const berlinDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const hm = iso => new Date(iso).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const num = (v, digits = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function dayLabel(key) {
  if (key === berlinDay()) return 'Heute';
  if (key === berlinDay(new Date(Date.now() + 864e5))) return 'Morgen';
  return new Date(key + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

// fetch mit Zeitlimit; wirft bei HTTP-Fehlern
export async function getJson(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout ? AbortSignal.timeout(opts.timeout || 12000) : undefined });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Läuft DAILY auf dem Server (mit /api) oder nur als lokale Datei?
export const ONLINE = typeof location !== 'undefined' && (location.protocol === 'https:' || location.hostname === 'localhost');
