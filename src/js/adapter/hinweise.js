// Adapter „wetterhinweise“: macht aus dem Vertrag wetterhinweise v1 die Teile für den Bereich „Wetter“
// (Abzeichen in der Kopfzeile, Untertab „Hinweise“). Ohne DOM, testbar.
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

// Untertab „Hinweise“ (nur bei Warnung): je Hinweis eine Zeile – Zeitraum, amtliches Ereignis, farbiger Punkt der Stufe;
// beim Überfahren Stufe, amtliche Überschrift, Zeitraum, amtlicher Text unverändert, Empfehlung und Tipp. Leer, wenn nichts vorliegt.
export function zeilen(env, zone = 'Europe/Berlin', jetzt = Date.now()) {
  return liste(env).map(h => ({
    ico: `<span class="wh-punkt wh-s${h.stufe}" aria-hidden="true"></span>`,
    d: zeitraum(h, zone, jetzt), t: (h.stufe >= 3 ? STUFE_TEXT[h.stufe] + ': ' : '') + ereignisText(h.ereignis),
    tip: [`${STUFE_TEXT[h.stufe]}: ${h.titel || ereignisText(h.ereignis)} (${zeitraum(h, zone, jetzt, true)})`, h.beschreibung,
      h.empfehlung ? 'Empfehlung: ' + h.empfehlung : '', h.tipp ? 'Tipp (DAILY): ' + h.tipp : ''].filter(Boolean).join('\n'),
    gruppe: 1
  }));
}
