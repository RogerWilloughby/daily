// Adapter „wetterhinweise“: macht aus dem Vertrag wetterhinweise v1 die Teile für die Wetterkachel
// (Abzeichen in der Kopfzeile, kurzer Hinweis, Reiter „Hinweise“) und die Antwort für „Frag DAILY“. Ohne DOM, testbar.
// Grundsatz: freundlich formuliert, aber nichts verharmlost – ab Stufe 3 (Unwetter) bleibt die amtliche Warnung im Vordergrund.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const ART_TEXT = { gewitter: 'Gewitter', wind: 'Wind', regen: 'Starkregen', schnee: 'Schnee', glaette: 'Glätte', frost: 'Frost',
  nebel: 'Nebel', hitze: 'Hitze', uv: 'UV', tauwetter: 'Tauwetter', sonstiges: 'Hinweis' };
export const STUFE_TEXT = ['', 'Wetterhinweis', 'Markantes Wetter', 'Unwetterwarnung', 'Extreme Unwetterwarnung'];

// „STURMBÖEN“ → „Sturmböen“, „STARKES GEWITTER“ → „Starkes Gewitter“
export const ereignisText = e => { const s = String(e || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

// Zeitangabe in der Zeitzone des Orts: „14 Uhr“, „morgen 6 Uhr“, „Mo 18 Uhr“
export function uhrzeit(iso, zone = 'Europe/Berlin', jetzt = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso), tag = d => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d);
  const hm = t.toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).replace(/^0/, '');
  const uhr = hm.endsWith(':00') ? hm.slice(0, -3) + ' Uhr' : hm + ' Uhr';
  if (tag(t) === tag(new Date(jetzt))) return uhr;
  if (tag(t) === tag(new Date(jetzt + 864e5))) return 'morgen ' + uhr;
  return t.toLocaleDateString('de-DE', { timeZone: zone, weekday: 'short' }) + ' ' + uhr;
}
// kurz: „ab 14 Uhr“ bzw. „bis 18 Uhr“; lang: „14 – 18 Uhr“ (mit Tag, wenn nicht heute)
const zeitraum = (h, zone, jetzt, lang = false) => {
  const von = uhrzeit(h.beginn, zone, jetzt), bis = uhrzeit(h.ende, zone, jetzt);
  if (h.aktiv || !h.beginn) return bis ? `bis ${bis}` : 'jetzt';
  if (!lang || !bis) return `ab ${von}`;
  const vonOhne = von.replace(/ Uhr$/, ''), gleicherTag = von.split(' ').length === bis.split(' ').length && !/ .* /.test(von);
  return gleicherTag ? `${vonOhne} – ${bis}` : `${von} – ${bis}`;
};
// Badge-Text: kurzes amtliches Ereignis („Sturmböen“), sonst die Art („Wind“)
const kurzName = h => { const e = ereignisText(h.ereignis); return e && e.length <= 14 ? e : ART_TEXT[h.art]; };
const liste = env => (env && env.daten && env.daten.hinweise) || [];

// Abzeichen für die Kopfzeile (nur wenn es einen Hinweis gibt, sonst '')
export function abzeichen(env) {
  const l = liste(env);
  if (!l.length) return '';
  const h = l[0], mehr = l.length > 1 ? ` +${l.length - 1}` : '';
  const text = (h.stufe >= 3 ? 'Unwetter: ' : '') + kurzName(h);
  const tip = l.map(x => `${STUFE_TEXT[x.stufe]}: ${ereignisText(x.ereignis)}`).join(' · ');
  return `<span class="wh-badge wh-s${h.stufe}" title="${esc(tip)}">${h.stufe >= 3 ? '! ' : ''}${esc(text)}${esc(mehr)}</span>`;
}

// Kurzer Hinweis für die Kachelzeile: „Sturmböen ab 14 Uhr.“ (null, wenn nichts vorliegt)
export function kurz(env, zone = 'Europe/Berlin', jetzt = Date.now()) {
  const l = liste(env);
  if (!l.length) return null;
  const h = l[0];
  return `${h.stufe >= 3 ? STUFE_TEXT[h.stufe] + ': ' : ''}${ereignisText(h.ereignis)} ${zeitraum(h, zone, jetzt)}.`;
}

// Reiter „Hinweise“: je Hinweis Stufe, amtliche Überschrift, Zeitraum, amtlicher Text unverändert, darunter der Tipp
// (gleicher Tipp wie beim vorigen Hinweis wird nicht wiederholt – so bleibt alles ohne Scrollen sichtbar)
// Der Reiter ist immer da: ohne Hinweis sagt er ruhig „keine Hinweise“ (mit Stand und Quelle).
// ort: { name, land } des gewählten Orts – für den Text, wenn nichts vorliegt oder der Dienst fehlt
export function reiter(env, zone = 'Europe/Berlin', jetzt = Date.now(), ort = {}) {
  const l = liste(env);
  if (!env || !env.daten) {
    const text = ort.land && ort.land !== 'DE' ? 'Amtliche Wetterhinweise gibt es bei DAILY bisher nur für Orte in Deutschland.'
      : 'Die Wetterhinweise sind gerade nicht erreichbar.';
    return `<div class="wh-feld wh-ruhig"><p>${esc(text)}</p></div>`;
  }
  if (!l.length) {
    const wo = env.daten.gebiet || ort.name || 'deinen Ort', stand = env.erstellt ? uhrzeit(env.erstellt, zone, jetzt) : '';
    return `<div class="wh-feld wh-ruhig"><p class="wh-keine">✓ Keine amtlichen Wetterhinweise für ${esc(wo)}.</p>` +
      `<p class="wh-quelle">${stand ? `Stand ${esc(stand)} · ` : ''}Quelle: Deutscher Wetterdienst. Liegt etwas vor, steht es hier – mit Zeitraum, amtlichem Text und einem Tipp.</p></div>`;
  }
  const karten = l.slice(0, 4).map((h, i) => `<article class="wh-karte wh-s${h.stufe}">` +
    `<header><span class="wh-stufe">${esc(STUFE_TEXT[h.stufe])}</span> <b class="wh-titel">${esc(h.titel || ereignisText(h.ereignis))}</b> <small>${esc(zeitraum(h, zone, jetzt, true))}</small></header>` +
    (h.beschreibung ? `<p>${esc(h.beschreibung)}</p>` : '') +
    (h.empfehlung ? `<p class="wh-amtlich"><b>Empfehlung:</b> ${esc(h.empfehlung)}</p>` : '') +
    (i && l[i - 1].tipp === h.tipp ? '' : `<p class="wh-tipp"><b>Tipp:</b> ${esc(h.tipp)}</p>`) + '</article>').join('');
  const mehr = l.length > 4 ? `<p class="wh-mehr">${l.length - 4} weitere Hinweise auf dwd.de</p>` : '';
  const gebiet = env.daten.gebiet ? ` · ${esc(env.daten.gebiet)}` : '';
  return `<div class="wh-feld">${karten}${mehr}<p class="wh-quelle">Amtliche Warnungen: Deutscher Wetterdienst${gebiet}. Tipps: DAILY.</p></div>`;
}

// Antwort für „Frag DAILY“
export function antwort(env, ortName = '', zone = 'Europe/Berlin', jetzt = Date.now()) {
  if (!env || !env.daten) return 'Die Wetterhinweise sind gerade nicht erreichbar.';
  const l = liste(env), wo = env.daten.gebiet || ortName;
  if (!l.length) return `Für ${wo} liegt kein amtlicher Wetterhinweis vor.`;
  return l.slice(0, 3).map(h => `${ereignisText(h.ereignis)} (${STUFE_TEXT[h.stufe]}) ${zeitraum(h, zone, jetzt, true)}`).join('; ') +
    `. Tipp: ${l[0].tipp} Quelle: Deutscher Wetterdienst.`;
}
