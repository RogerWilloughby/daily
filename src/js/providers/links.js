// „Meine Seiten“: Links zu den eigenen Portalen (Mail, Nachrichten, Kalender …) und bekannte Seiten je Kategorie.
// Mini-Reiter: „Meine Seiten“ + bis zu 4 Kategorien (News, Social Media, Mail …), alle als Symbolraster; Zahnrad → Einstellungsfenster.
// DAILY zeigt keine fremden Inhalte – nur Links. Deine Auswahl bleibt auf diesem Gerät; die Seiten-Auswahl ist eine feste Datei.
import { set } from '../core/board.js';
import { links, saveLinks, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { getJson } from '../core/util.js';
import { kachel, felder, ausEinstellung } from '../adapter/seiten.js';

const ID = 'links';
let katalog = null;
const opt = () => kachelOpt(ID, {});
const paint = () => set(ID, kachel(links, katalog, opt()));

// Seitensymbol nicht zu bekommen → Bild entfernen, der farbige Buchstabe darunter bleibt
document.addEventListener('error', e => { const t = e.target; if (t && t.classList && t.classList.contains('ms-bild')) t.remove(); }, true);

addAnswer(/seite|link|portal|lesezeichen/i, () => links.length ? `Deine Seiten: ${links.map(l => l.name).join(', ')}. Sie stehen in der Kachel „Meine Seiten“.` : 'Noch keine Seiten gespeichert.');

kachelEinstellungen(ID, {
  felder: () => (katalog ? felder(links, katalog, opt()) : [{ typ: 'hinweis', label: 'Die Seiten-Auswahl wird geladen …' }]),
  speichern: w => {
    if (!katalog) return;
    const r = ausEinstellung(w, links, katalog);
    links.splice(0, links.length, ...r.links);
    saveLinks();
    kachelOptSpeichern(ID, { kategorien: r.kategorien });
    paint();
  }
});

export async function load() {
  if (!katalog) katalog = await getJson('/content/seiten.json').catch(() => null);
  paint();
}

export default { id: ID, name: 'Meine Seiten', local: true, every: 60 * 60e3, load };
