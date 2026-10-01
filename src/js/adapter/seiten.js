// Adapter „Meine Seiten“: macht aus deiner Auswahl (Links im Browser) und der festen Seiten-Auswahl (src/content/seiten.json)
// die Mini-Reiter der Kachel – „Meine Seiten“ plus Kategorie-Reiter (News, Social Media, Mail …), alle als Symbolraster –
// sowie das Einstellungsfenster. Nur Links, keine fremden Inhalte. Rein, ohne DOM – testbar.
import { esc, icon } from '../core/util.js';
import { cleanUrl } from '../lib/url.js';

export const MAX_KATEGORIEN = 4;   // mehr passen bei 1400 px nicht in die Reiterspalte (plus „Meine Seiten“ und Zahnrad)
export const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const alle = katalog => (katalog ? katalog.kategorien.flatMap(k => k.seiten) : []);
// Seite aus der Auswahl zu einem Link (gleicher Host) – dann gibt es ein echtes Seitensymbol
export const seiteZu = (link, katalog) => alle(katalog).find(s => host(s.url) === host(link.url)) || null;
// Farbe des Buchstaben-Symbols aus dem Namen (immer gleich für denselben Namen)
export const farbe = name => [...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// Ein Symbol: farbiger Buchstabe; bei Seiten aus der Auswahl liegt das Seitensymbol darüber (/api/icon, fehlt es, bleibt der Buchstabe)
export function symbol(name, seite) {
  const b = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="ms-sym" style="--ms-h:${farbe(name)}"><b>${esc(b)}</b>` +
    (seite ? `<img class="ms-bild" src="/api/icon?s=${esc(seite.id)}" alt="" loading="lazy" decoding="async">` : '') + '</span>';
}
// Symbolraster: je Seite Symbol und Name; Klick öffnet im neuen Tab (das Raster blendet Reihen aus, die nicht ganz passen)
export const raster = (eintraege, katalog) => `<div class="ms-raster">${eintraege.map(e => {
  const seite = e.katalog ? e : seiteZu(e, katalog);
  return `<a class="ms-z kr-z" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" title="${esc(`${e.name} · ${host(e.url)}`)}">${symbol(e.name, seite)}<span class="ms-name">${esc(e.name)}</span></a>`;
}).join('')}</div>`;

// Gewählte Kategorie-Reiter (Standard aus der Datei, höchstens MAX_KATEGORIEN, in der Reihenfolge der Datei)
export function kategorien(katalog, opt = {}) {
  if (!katalog) return [];
  const wahl = Array.isArray(opt.kategorien) ? opt.kategorien : katalog.standard;
  return katalog.kategorien.filter(k => wahl.includes(k.id)).slice(0, MAX_KATEGORIEN);
}

// Kachel (Felder wie core/board.js erwartet)
export function kachel(links, katalog, opt = {}) {
  const meine = links.length ? raster(links, katalog)
    : '<p class="ms-text">Noch keine eigenen Seiten. Im Zahnrad Seiten aus den Kategorien anhaken oder eigene eintragen.</p>';
  const kats = kategorien(katalog, opt);
  return {
    state: 'local', m: links.length === 1 ? '1 Seite' : links.length + ' Seiten', ms: String(links.length),
    x: links.length ? links.map(l => l.name).join(' · ') : 'Lege deine Mail-, Nachrichten- oder Kalenderseite hier ab.',
    kleinReiter: [
      { id: 'meine', name: 'Meine Seiten', icon: icon('stern'), kopf: `<b>Meine Seiten</b>`, html: meine },
      ...kats.map(k => ({ id: k.id, name: k.name, icon: icon(k.icon), kopf: `<b>${esc(k.name)}</b>`, html: raster(k.seiten.map(s => ({ ...s, katalog: true })), katalog) }))
    ],
    startReiter: 'meine',
    info: ['Nur Links – öffnen im neuen Tab', 'Deine Auswahl bleibt in diesem Browser', 'Symbole von den jeweiligen Seiten']
  };
}

// Eigene Seiten (nicht aus der Auswahl) als Text „Name | Adresse“, eine je Zeile
export const eigeneText = (links, katalog) => links.filter(l => !seiteZu(l, katalog)).map(l => `${l.name} | ${l.url}`).join('\n');
export function eigeneAus(text) {
  return String(text || '').split('\n').map(z => z.trim()).filter(Boolean).map(z => {
    const [a, b] = z.includes('|') ? z.split('|').map(x => x.trim()) : [null, z];
    const url = cleanUrl(b);
    return url ? { name: (a || host(url)).slice(0, 40), url } : null;
  }).filter(Boolean);
}

// Felder des Einstellungsfensters
export function felder(links, katalog, opt = {}) {
  const gewaehlt = new Set(kategorien(katalog, opt).map(k => k.id));
  const drin = new Set(links.map(l => (seiteZu(l, katalog) || {}).id).filter(Boolean));
  return [
    { typ: 'titel', label: `Reiter (höchstens ${MAX_KATEGORIEN} Kategorien)` },
    ...katalog.kategorien.map(k => ({ typ: 'check', key: 'r_' + k.id, label: k.name, wert: gewaehlt.has(k.id) })),
    ...katalog.kategorien.flatMap(k => [{ typ: 'titel', label: `In „Meine Seiten“ · ${k.name}` },
      ...k.seiten.map(s => ({ typ: 'check', key: 'm_' + s.id, label: s.name, wert: drin.has(s.id) }))]),
    { typ: 'titel', label: 'Eigene Seiten' },
    { typ: 'textarea', key: 'eigene', label: 'Je Zeile „Name | Adresse“', wert: eigeneText(links, katalog), platzhalter: 'Sächsische | saechsische.de',
      hilfe: 'Eigene Seiten bekommen ein Buchstaben-Symbol. Alles bleibt nur in diesem Browser.' }
  ];
}

// Werte des Einstellungsfensters → neue Linkliste (Reihenfolge deiner Auswahl: Bisheriges bleibt an seinem Platz, Neues kommt hinten dran)
// und gewählte Kategorien (höchstens MAX_KATEGORIEN, in der Reihenfolge der Datei)
export function ausEinstellung(w, links, katalog) {
  const seiten = alle(katalog), eigene = eigeneAus(w.eigene), eigenHosts = eigene.map(e => host(e.url));
  // angehakt – oder als eigene Seite eingetragen, obwohl sie in der Auswahl steht (dann mit Seitensymbol)
  const an = id => !!w['m_' + id] || eigenHosts.includes(host((seiten.find(s => s.id === id) || {}).url || ''));
  const bleibt = links.filter(l => { const s = seiteZu(l, katalog); return s ? an(s.id) : eigenHosts.includes(host(l.url)); })
    .map(l => { const e = !seiteZu(l, katalog) && eigene.find(x => host(x.url) === host(l.url)); return e ? { ...l, name: e.name, url: e.url } : l; });
  const hosts = new Set(bleibt.map(l => host(l.url)));
  const neuKatalog = seiten.filter(s => an(s.id) && !hosts.has(host(s.url))).map(s => ({ id: 'k-' + s.id, name: s.name, url: s.url }));
  neuKatalog.forEach(s => hosts.add(host(s.url)));
  const neuEigen = eigene.filter(e => !hosts.has(host(e.url)) && !seiten.some(s => host(s.url) === host(e.url))).map(e => ({ id: 'e-' + host(e.url), ...e }));
  const gewaehlt = katalog.kategorien.filter(k => w['r_' + k.id]).map(k => k.id);
  return { links: [...bleibt, ...neuKatalog, ...neuEigen], kategorien: gewaehlt.slice(0, MAX_KATEGORIEN), zuviel: gewaehlt.length > MAX_KATEGORIEN };
}
