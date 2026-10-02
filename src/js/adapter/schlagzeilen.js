// Adapter „schlagzeilen“: macht aus der Antwort des Dienstes „schlagzeilen“ (nur privat) die Kachel „Schlagzeilen“
// und die Antwort für „Frag DAILY“. Ohne DOM, testbar. Mini-Reiter (seit 0.44.0): Neueste · je Quelle ein Reiter, kein Aufklappen.
// Jede Zeile ist ein Link zum Artikel beim Anbieter (neuer Tab). Originalüberschriften, keine eigene Auswahl.
import { esc, icon } from '../core/util.js';

// Symbole: Neueste, dann je Quelle (Tagesschau = Welt, MDR = Region, heise = Technik); unbekannte Quellen → Zeitung
const SYM = { neueste: 'news', tagesschau: 'globe', mdr: 'haus', heise: 'chip' };
export const FRISCH_MS = 12 * 3600e3;   // „neu“ = in den letzten 12 Stunden

const tagVon = (iso, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const uhr = (iso, zone) => new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
// „14:05“ heute, sonst „1.10.“ (Uhrzeit beim Überfahren)
const wann = (iso, jetzt, zone) => !iso ? '–' : tagVon(iso, zone) === tagVon(new Date(jetzt).toISOString(), zone) ? uhr(iso, zone)
  : new Date(iso).toLocaleDateString('de-DE', { timeZone: zone, day: 'numeric', month: 'numeric' });
const lang = (iso, zone) => (iso ? new Date(iso).toLocaleString('de-DE', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Zeit unbekannt');

// Die Kachel. env: Antwort des Dienstes oder null; kennwort: true = Kennwort fehlt oder ist falsch (dann gibt es keine Daten)
export function kachel(env, jetzt = Date.now(), zone = 'Europe/Berlin', kennwort = false) {
  const d = env && env.daten;
  if (!d) {
    const text = kennwort ? 'Kennwort für den privaten Betrieb fehlt oder ist falsch – Einstellungen → „Privater Betrieb“.' : 'Die Schlagzeilen sind gerade nicht erreichbar.';
    return { state: kennwort ? 'off' : 'error', title: 'Schlagzeilen', m: kennwort ? 'Kennwort' : '–', ms: '–', x: text, liste: [],
      kleinReiter: [{ id: 'neueste', name: 'Neueste', icon: icon(SYM.neueste), kopf: '<b>Schlagzeilen</b>', html: `<p class="kl-leer">${esc(text)}</p>` }] };
  }
  const name = Object.fromEntries(d.quellen.map(q => [q.id, q.name]));
  const zeile = (m, mitQuelle) => ({ d: wann(m.zeit, jetzt, zone), t: m.titel, href: m.link,
    tip: `${mitQuelle ? `${name[m.quelle] || m.quelle} · ` : ''}${lang(m.zeit, zone)} · ${m.titel}` });
  const frisch = d.meldungen.filter(m => m.zeit && Date.parse(m.zeit) > jetzt - FRISCH_MS).length;
  const gestoert = d.quellen.filter(q => !q.erreichbar);

  const reiter = [{ id: 'neueste', name: 'Neueste', icon: icon(SYM.neueste),
    kopf: `<b>${frisch} neu</b> <small>${gestoert.length ? `ohne ${esc(gestoert.map(q => q.name).join(', '))}` : 'alle Quellen, neueste zuerst'}</small>`,
    liste: d.meldungen.map(m => zeile(m, true)), html: '<p class="kl-leer">Gerade keine Schlagzeilen.</p>' }];
  d.quellen.forEach(q => reiter.push({ id: q.id, name: q.name, icon: icon(SYM[q.id] || 'news'),
    kopf: `<b>${esc(q.name)}</b>${q.erreichbar ? '' : ' <small>nicht erreichbar</small>'}`,
    liste: q.erreichbar ? d.meldungen.filter(m => m.quelle === q.id).map(m => zeile(m, false)) : [],
    html: q.erreichbar ? '<p class="kl-leer">Gerade keine Schlagzeilen.</p>' : `<p class="kl-leer">${esc(q.name)} ist gerade nicht erreichbar.</p>` }));

  const erste = d.meldungen[0];
  return {
    state: 'live', title: 'Schlagzeilen', m: `${frisch} neu`, ms: `${frisch} neu`,
    x: erste ? `${name[erste.quelle] || erste.quelle}: ${erste.titel}` : 'Gerade keine Schlagzeilen.',
    liste: [], kleinReiter: reiter, startReiter: 'neueste',
    info: [`Quellen: ${d.quellen.map(q => q.name + (q.erreichbar ? '' : ' (nicht erreichbar)')).join(', ')}`, 'Originalüberschriften der Anbieter, neueste zuerst – keine eigene Auswahl']
  };
}

// Antwort für „Frag DAILY“
export function antwort(env, kennwort = false) {
  const d = env && env.daten;
  if (!d) return kennwort ? 'Für die Schlagzeilen fehlt das Kennwort des privaten Betriebs (Einstellungen → „Privater Betrieb“).' : 'Die Schlagzeilen sind gerade nicht erreichbar.';
  if (!d.meldungen.length) return 'Gerade gibt es keine Schlagzeilen.';
  const name = Object.fromEntries(d.quellen.map(q => [q.id, q.name]));
  return 'Neueste Schlagzeilen: ' + d.meldungen.slice(0, 3).map(m => `${name[m.quelle] || m.quelle}: ${m.titel}`).join(' · ');
}
