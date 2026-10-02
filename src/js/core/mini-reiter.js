// Mini-Reiter in der kleinen Kachel (Entscheidung 29.09.2026, entscheidungen.md Abschnitt 13 – seit 0.45.0 das einzige Bedienmodell).
// t.kleinReiter: [{ id, name, icon (SVG aus eigenem Code), kopf? (HTML), liste? ([{ d, t, tip?, gruppe?, href?, aktion?, ico? }]),
//                   html? (wenn die Liste leer ist), unten? (HTML unter der Liste, z. B. ein Diagramm – bekommt zuerst seinen Platz,
//                   die Liste zeigt, was darüber passt) }]
// Links unter der Kopfzeile eine schmale Spalte mit Symbolen (Name beim Überfahren), rechts der Inhalt des gewählten Reiters.
// Die Wahl bleibt je Kachel gespeichert (Kachel-Einstellung „reiter“); t.startReiter gilt, solange nichts gewählt ist.
// Hat die Kachel Einstellungen, steht unten ein Zahnrad – es öffnet das Einstellungsfenster (core/einstellungsfenster.js).
// Zeilen, die nicht mehr ganz in die Kachel passen, werden ausgeblendet (kein Scrollen, keine halben Zeilen).
import { esc } from './util.js';
import { kachelOpt } from './store.js';
import { hatEinstellungen, ZAHNRAD } from './einstellungen.js';

export const hatReiter = t => !!(t.kleinReiter && t.kleinReiter.length);

// gewählter Reiter: gespeichert > startReiter > erster
export function krWahl(t) {
  const gibt = id => t.kleinReiter.some(x => x.id === id), gespeichert = kachelOpt(t.id).reiter;
  return gibt(gespeichert) ? gespeichert : gibt(t.startReiter) ? t.startReiter : t.kleinReiter[0].id;
}
export const gewaehlt = t => t.kleinReiter.find(x => x.id === krWahl(t));

// Liste: [{ d, t, gruppe, tip? }] – zwischen Gruppen ein kleiner Abstand; tip = Text beim Überfahren
// z.href: Zeile ist ein Link (neuer Tab); z.aktion: Zeile löst eine Aktion der Kachel aus (data-aktion, der Anbieter hört darauf);
// z.ico: Symbol-HTML davor (nur aus eigenem Code)
export function listeHtml(l) {
  return l.map((z, i) => {
    const cls = `tl-z${i && z.gruppe !== l[i - 1].gruppe ? ' tl-neu' : ''}${z.href ? ' tl-link' : ''}${z.aktion ? ' tl-aktion' : ''}`, tip = z.tip ? ` title="${esc(z.tip)}"` : '';
    const inhalt = `${z.ico || ''}<span class="tl-d">${esc(z.d)}</span> <span class="tl-t">${esc(z.t)}</span>`;
    if (z.aktion) return `<span class="${cls}"${tip} role="button" tabindex="0" data-aktion="${esc(z.aktion)}">${inhalt}</span>`;
    return z.href ? `<a class="${cls}"${tip} href="${esc(z.href)}" target="_blank" rel="noopener">${inhalt}</a>` : `<span class="${cls}"${tip}>${inhalt}</span>`;
  }).join('');
}

// Reiterspalte und Inhalt des gewählten Reiters
export function krHtml(t) {
  const wahl = krWahl(t), r = t.kleinReiter.find(x => x.id === wahl);
  const knopf = x => `<button type="button" role="tab" data-kr="${esc(x.id)}" aria-selected="${x.id === wahl}" title="${esc(x.name)}" aria-label="${esc(x.name)}">${x.icon || esc(x.name.slice(0, 2))}</button>`;
  const einst = hatEinstellungen(t.id) ? `<button type="button" class="kr-einst" data-kr-einst title="Einstellungen" aria-label="Einstellungen">${ZAHNRAD}</button>` : '';
  const inhalt = (r.liste && r.liste.length ? `<div class="kr-liste">${listeHtml(r.liste)}</div>` : (r.html || '')) +   // leere Liste → html (Hinweistext)
    (r.unten ? `<div class="kr-unten">${r.unten}</div>` : '');
  return `<div class="kr-leiste" role="tablist" aria-label="Ansichten">${t.kleinReiter.map(knopf).join('')}${einst}</div>` +
    `<div class="kr-feld" role="tabpanel">${inhalt}</div>`;
}

// Zeilen (bzw. Raster-Elemente .kr-z) ausblenden, die unten über den Rand ragen würden
export function krZeilen(el) {
  const feld = el.querySelector('.kr-feld'); if (!feld) return;
  const zeilen = [...feld.querySelectorAll('.kr-liste .tl-z, .kr-z')];   // Listenzeilen und Kacheln eines Rasters (z. B. Seitensymbole)
  zeilen.forEach(z => { z.hidden = false; });
  // mit Diagramm darunter: Grenze ist das Ende der Liste (sie bekommt den Platz über dem Diagramm), sonst das Feld
  const rahmen = feld.querySelector('.kr-unten') ? feld.querySelector('.kr-liste') : feld;
  if (!rahmen) return;
  const unten = rahmen.getBoundingClientRect().bottom;
  zeilen.forEach(z => { if (z.getBoundingClientRect().bottom > unten + 0.5) z.hidden = true; });
}
