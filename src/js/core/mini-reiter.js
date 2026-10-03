// Listen im Feld eines Untertabs (seit 0.47.3 nur noch dieser Teil des früheren Mini-Reiter-Bausteins).
// Untertab: { id, name, kopf? (HTML), liste? ([{ d, t, tip?, gruppe?, href?, aktion?, ico? }]), html? (wenn die Liste leer ist),
//             unten? (HTML unter der Liste, z. B. ein Diagramm – bekommt zuerst seinen Platz, die Liste zeigt, was darüber passt) }
// Zeilen, die nicht mehr ganz ins Feld passen, werden ausgeblendet (kein Scrollen, keine halben Zeilen).
import { esc } from './util.js';

// Liste: [{ d, t, gruppe, tip? }] – zwischen Gruppen ein kleiner Abstand; tip = Text beim Überfahren
// z.href: Zeile ist ein Link (neuer Tab); z.aktion: Zeile löst eine Aktion aus (data-aktion, der Anbieter hört darauf);
// z.ico: Symbol-HTML davor (nur aus eigenem Code)
export function listeHtml(l) {
  return l.map((z, i) => {
    const cls = `tl-z${i && z.gruppe !== l[i - 1].gruppe ? ' tl-neu' : ''}${z.href ? ' tl-link' : ''}${z.aktion ? ' tl-aktion' : ''}`, tip = z.tip ? ` title="${esc(z.tip)}"` : '';
    const inhalt = `${z.ico || ''}<span class="tl-d">${esc(z.d)}</span> <span class="tl-t">${esc(z.t)}</span>`;
    if (z.aktion) return `<span class="${cls}"${tip} role="button" tabindex="0" data-aktion="${esc(z.aktion)}">${inhalt}</span>`;
    return z.href ? `<a class="${cls}"${tip} href="${esc(z.href)}" target="_blank" rel="noopener">${inhalt}</a>` : `<span class="${cls}"${tip}>${inhalt}</span>`;
  }).join('');
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
