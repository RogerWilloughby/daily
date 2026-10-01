// Tagesinhalte aus /content/daily.json (31 Tage vorbereitet; danach wiederholt sich der Vorrat).
import { set } from '../core/board.js';
import { addAnswer } from '../core/ask.js';
import { esc, berlinDay, getJson } from '../core/util.js';

let file = null, today = null;
// Teaser ohne die Überschrift, falls der Text mit ihr beginnt („Deckel auf den Topf: Beim Kochen …“)
const rest = o => {
  if (!o.text.startsWith(o.kurz)) return o.text;
  const r = o.text.slice(o.kurz.length).replace(/^[\s:–-]+/, '');
  return r ? r[0].toUpperCase() + r.slice(1) : o.text;
};

export async function getToday() {
  if (!file) file = await getJson('/content/daily.json');
  const key = berlinDay();
  let d = file.tage.find(t => t.datum === key);
  if (!d) { // außerhalb des Vorrats: Tag im Jahr → Eintrag im Kreis
    const doy = Math.floor((Date.parse(key) - Date.parse(key.slice(0, 4) + '-01-01')) / 864e5);
    d = file.tage[doy % file.tage.length];
  }
  return d;
}

function renderFood(el) {
  const r = today.rezept;
  el.innerHTML = `<p>${r.minuten} Minuten · für 2 Personen${r.vegetarisch ? ' · vegetarisch' : ''}</p>
    <h4>Zutaten</h4><ul class="blist">${r.zutaten.map(z => `<li>${esc(z)}</li>`).join('')}</ul>
    <h4>Zubereitung</h4><p>${esc(r.zubereitung)}</p>`;
}

export async function load() {
  today = await getToday();
  const t = today;
  // Rätsel, Witz, Film: seit 0.34.0 Kachel „Unterhaltung“ (providers/unterhaltung.js, Dienst „tagesinhalt“)
  set('food', { state: 'content', m: t.rezept.name, ms: t.rezept.minuten + ' min',
    x: `${t.rezept.minuten} Minuten · für 2${t.rezept.vegetarisch ? ' · vegetarisch' : ''}`, render: renderFood });
  set('travel', { state: 'content', m: t.land.name, ms: t.land.name, x: t.land.fakt,
    rows: [['Hauptstadt', t.land.hauptstadt], ['Sprache', t.land.sprache], ['Währung', t.land.waehrung], ['Typisches Gericht', t.land.gericht], ['Wissenswert', t.land.fakt]] });
  set('tech', { state: 'content', m: t.tech.kategorie, ms: t.tech.kategorie, x: t.tech.text, rows: [[t.tech.kategorie, t.tech.text]] });
  // Spartipp: seit 0.31.0 Reiter „Spartipp“ der Kachel „Finanzen“ (providers/finanzen.js holt ihn über getToday)
  set('relation', { state: 'content', m: t.beziehung.kurz, ms: 'Idee', x: rest(t.beziehung), rows: [['Idee für heute', t.beziehung.text]] });
  set('health', { state: 'content', m: t.gesundheit.kurz, ms: 'Tipp', x: rest(t.gesundheit),
    rows: [['Für heute', t.gesundheit.text], ['Später', 'Schritte und Schlaf von der Smartwatch (Stufe 2)'], ['Hinweis', 'Allgemeine Anregung, keine medizinische Beratung.']] });
}

addAnswer(/rezept|koch|essen|abendbrot|mittag/i, () => today ? `Heute: ${today.rezept.name} (${today.rezept.minuten} Minuten${today.rezept.vegetarisch ? ', vegetarisch' : ''}). Zutaten: ${today.rezept.zutaten.join(', ')}.` : null);
addAnswer(/land|reise|urlaub/i, () => today ? `Land des Tages: ${today.land.name}, Hauptstadt ${today.land.hauptstadt}. ${today.land.fakt}` : null);
addAnswer(/spar|geld sparen/i, () => today ? `Spartipp: ${today.spartipp.text}` : null);
addAnswer(/beziehung|partner|date|paar/i, () => today ? `Idee für heute: ${today.beziehung.text}` : null);
addAnswer(/gesund|fitness|bewegung|sport treiben/i, () => today ? `Für heute: ${today.gesundheit.text}` : null);

export default { id: 'content', name: 'Tagesinhalte', every: 30 * 60e3, load, local: true };
