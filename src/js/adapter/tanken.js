// Adapter „tanken“: macht aus dem Vertrag tanken v1 die Ansicht „Tanken“ der Kachel „Verkehr“ und Antworten für Frag DAILY.
// Rein, ohne DOM – testbar.
import { esc } from '../core/util.js';

export const SORTEN = ['e10', 'e5', 'diesel'];
export const SORTE_NAME = { e5: 'Super E5', e10: 'Super E10', diesel: 'Diesel' };
export const SORTE_KURZ = { e5: 'E5', e10: 'E10', diesel: 'Diesel' };
export const UMKREISE = [2, 5, 10];
const HOCH = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const km = v => (v == null ? '' : `${String(v).replace('.', ',')} km`);

// Tankstellen-Schreibweise: 1.749 → „1,74⁹“ (nicht runden); mitEuro → „1,74⁹ €“
export function preis(p, mitEuro = true) {
  if (p == null) return '–';
  const c = Math.round(p * 1000);
  return `${Math.floor(c / 1000)},${String(Math.floor((c % 1000) / 10)).padStart(2, '0')}${HOCH[c % 10]}${mitEuro ? ' €' : ''}`;
}
export const sorteVon = s => (SORTEN.includes(s) ? s : 'e10');
// „ARAL“ / „Freie Tankstelle“ (ohne Marke der Name)
const titel = s => s.marke || s.name || 'Tankstelle';
const adresse = s => [s.strasse, s.ort].filter(Boolean).join(', ');
// Alle Sorten einer Tankstelle: „E10 1,68⁹ · E5 1,74⁹ · Diesel 1,59⁹“
export const allePreise = s => SORTEN.filter(x => s.preise[x] != null).map(x => `${SORTE_KURZ[x]} ${preis(s.preise[x], false)}`).join(' · ');

// Ansicht „Tanken“ (Felder wie core/board.js erwartet; die Kachel „Verkehr“ setzt Umschalter und Reiter zusammen)
export function ansicht(env, sorte = 'e10') {
  const s = sorteVon(sorte), d = env && env.daten;
  if (!d) return { kopf: 'Tanken', m: '', ms: '–', x: 'Die Spritpreise sind gerade nicht erreichbar.', liste: [], html: '<p>Die Spritpreise sind gerade nicht erreichbar.</p>' };
  const best = d.guenstigste[s];
  const mit = d.stationen.filter(x => x.offen && x.preise[s] != null).sort((a, b) => a.preise[s] - b.preise[s] || (a.entfernungKm ?? 99) - (b.entfernungKm ?? 99));
  const ort = env.ort && env.ort.name ? ` um ${env.ort.name}` : '';
  if (!best) {
    const leer = `Im Umkreis von ${d.umkreisKm} km${ort} ist gerade keine Tankstelle mit ${SORTE_NAME[s]} geöffnet.`;
    return { kopf: `${esc(SORTE_KURZ[s])} · ${d.umkreisKm} km`, m: '', ms: '–', x: leer, liste: [], html: `<p>${esc(leer)}</p>` };
  }
  const b = d.stationen.find(x => x.id === best.id);
  const liste = mit.slice(0, 3).map(x => ({ d: preis(x.preise[s], false), t: `${titel(x)} · ${km(x.entfernungKm)}`,
    tip: `${titel(x)}, ${adresse(x)} · ${allePreise(x)}`, gruppe: 1 }));
  const schnitt = d.durchschnitt[s];
  // Aufgeklappt: alle Tankstellen im Umkreis, günstigste zuerst, geschlossene am Ende
  const zeile = x => `<div class="row${x.offen ? '' : ' vk-zu'}"><dt>${x.preise[s] != null ? `<b>${esc(preis(x.preise[s]))}</b>` : '–'}</dt>` +
    `<dd>${esc(titel(x))} · ${esc(adresse(x))} · ${esc(km(x.entfernungKm))}${x.offen ? '' : ' · <small>geschlossen</small>'}<br><small>${esc(allePreise(x))}</small></dd></div>`;
  const reihe = [...mit, ...d.stationen.filter(x => !mit.includes(x))];
  const html = `<p class="vk-hinweis">${esc(SORTE_NAME[s])} · Umkreis ${d.umkreisKm} km${esc(ort)} · ${d.anzahlOffen} von ${d.anzahl} geöffnet` +
    `${schnitt != null ? ` · Durchschnitt ${esc(preis(schnitt))}` : ''}</p><dl class="kompakt">${reihe.map(zeile).join('')}</dl>` +
    '<p class="vk-quelle">Quelle: Tankerkönig (CC BY 4.0), Markttransparenzstelle für Kraftstoffe · Angaben ohne Gewähr</p>';
  return {
    kopf: `${esc(SORTE_KURZ[s])} ab <b>${esc(preis(best.preis))}</b>`,
    m: `${SORTE_KURZ[s]} ${preis(best.preis)}`, ms: preis(best.preis),
    x: `${titel(b)}, ${adresse(b)} · ${km(b.entfernungKm)}${schnitt != null ? ` · Durchschnitt ${preis(schnitt)}` : ''}`,
    liste, html
  };
}

// Frag DAILY: „Wo ist Diesel günstig?“, „Was kostet E10?“ (null = nicht zuständig)
export function antwort(q, env, sorte = 'e10') {
  const t = String(q).toLowerCase();
  if (!/tank|benzin|diesel|sprit|super|\be10\b|\be5\b/.test(t)) return null;
  const s = /diesel/.test(t) ? 'diesel' : /\be5\b|super plus/.test(t) ? 'e5' : /\be10\b/.test(t) ? 'e10' : sorteVon(sorte);
  const d = env && env.daten;
  if (!d) return 'Die Spritpreise sind gerade nicht erreichbar.';
  const best = d.guenstigste[s];
  if (!best) return `Gerade keine geöffnete Tankstelle mit ${SORTE_NAME[s]} im Umkreis von ${d.umkreisKm} km.`;
  const b = d.stationen.find(x => x.id === best.id);
  return `Am günstigsten für ${SORTE_NAME[s]}: ${titel(b)}, ${adresse(b)} (${km(b.entfernungKm)}) mit ${preis(best.preis)}` +
    `${d.durchschnitt[s] != null ? `, Durchschnitt im Umkreis ${preis(d.durchschnitt[s])}` : ''}. Angaben ohne Gewähr.`;
}
