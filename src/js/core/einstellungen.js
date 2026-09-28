// Einstellungen je Kachel: Jede Kachel (bzw. ihr Anbieter) meldet hier ihre Felder an. Das Raster zeigt dann in der
// aufgeklappten Kachel einen Reiter mit Zahnrad (nur Symbol) – Formular und „Speichern“ entstehen von selbst.
// Nach dem Speichern: Ereignis „daily:einstellungen“ (detail = Kachel-ID) → main.js lädt den passenden Anbieter neu.
import { esc } from './util.js';

const REG = {};

// def = { felder(): Feld[], speichern(werte) }
// Feld: { typ: 'text'|'textarea'|'select'|'check'|'titel'|'hinweis', key, label, hilfe?, wert?, optionen?: [[wert, text]], platzhalter? }
export function kachelEinstellungen(id, def) { REG[id] = def; }
export const hatEinstellungen = id => !!REG[id] && REG[id].felder().some(f => f.key);

export const ZAHNRAD = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

// Formular als HTML (rein, testbar)
export function formular(id) {
  const def = REG[id]; if (!def) return '';
  const fid = k => `ke-${id}-${k}`;
  const hilfe = f => (f.hilfe ? `<small class="ke-hilfe">${esc(f.hilfe)}</small>` : '');
  const feld = f => {
    switch (f.typ) {
      case 'titel': return `<div class="ke-titel ke-breit">${esc(f.label)}</div>`;
      case 'hinweis': return `<div class="ke-hilfe ke-breit">${esc(f.label)}</div>`;
      case 'check': return `<label class="ke-check"><input type="checkbox" name="${esc(f.key)}"${f.wert ? ' checked' : ''}> ${esc(f.label)}</label>`;
      case 'textarea': return `<div class="ke-f ke-breit"><label class="ke-feld" for="${fid(f.key)}">${esc(f.label)}</label>${hilfe(f)}<textarea class="field" id="${fid(f.key)}" name="${esc(f.key)}" rows="2" spellcheck="false" placeholder="${esc(f.platzhalter || '')}">${esc(f.wert || '')}</textarea></div>`;
      case 'select': return `<div class="ke-f"><label class="ke-feld" for="${fid(f.key)}">${esc(f.label)}</label>${hilfe(f)}<select class="field" id="${fid(f.key)}" name="${esc(f.key)}">` +
        f.optionen.map(([w, t]) => `<option value="${esc(w)}"${String(w) === String(f.wert) ? ' selected' : ''}>${esc(t)}</option>`).join('') + '</select></div>';
      default: return `<div class="ke-f"><label class="ke-feld" for="${fid(f.key)}">${esc(f.label)}</label>${hilfe(f)}<input class="field" id="${fid(f.key)}" name="${esc(f.key)}" type="text" autocomplete="off" value="${esc(f.wert || '')}" placeholder="${esc(f.platzhalter || '')}"></div>`;
    }
  };
  // aufeinanderfolgende Kontrollkästchen in eine Zeile (spart Höhe – alles ohne Scrollen)
  const teile = [];
  for (const f of def.felder()) {
    if (f.typ === 'check' && teile.length && teile[teile.length - 1].checks) teile[teile.length - 1].checks.push(f);
    else teile.push(f.typ === 'check' ? { checks: [f] } : f);
  }
  return `<form class="ke" data-ke="${esc(id)}">${teile.map(t => t.checks ? `<div class="ke-checks ke-breit">${t.checks.map(feld).join('')}</div>` : feld(t)).join('')}` +
    `<div class="ke-aktionen ke-breit"><span class="ke-ok" role="status"></span><button type="submit" class="btn primary">Speichern</button></div></form>`;
}

// Werte aus dem Formular lesen (Kontrollkästchen → true/false)
export function werte(form) {
  const out = {};
  form.querySelectorAll('[name]').forEach(e => { out[e.name] = e.type === 'checkbox' ? e.checked : e.value; });
  return out;
}

// Formular in einer Kachel verbinden
export function binden(id, el) {
  const form = el.querySelector(`form[data-ke="${id}"]`); if (!form) return;
  form.addEventListener('click', e => e.stopPropagation());
  form.addEventListener('submit', e => {
    e.preventDefault();
    REG[id].speichern(werte(form));
    document.dispatchEvent(new CustomEvent('daily:einstellungen', { detail: id }));   // Raster zeichnet neu, main.js lädt den Anbieter neu
  });
}
