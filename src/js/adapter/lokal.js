// Adapter der lokalen Kacheln „Mein Daily“ (Aufgaben) und „Deine Nutzung“ (Klickzähler): Mini-Reiter statt Aufklappen (seit 0.38.0).
// Daten nur im Browser. Rein, ohne DOM – testbar; die Bedienung (Eingabe, Haken, Löschen) hängt providers/local.js an.
import { esc, icon } from '../core/util.js';

// Eine Aufgabe: Haken, Text (ganz beim Überfahren), × löschen
const aufgabe = t => `<li class="kt-z${t.done ? ' kt-fertig' : ''}" data-kt="${esc(t.id)}"><label><input type="checkbox"${t.done ? ' checked' : ''} aria-label="${t.done ? 'Wieder offen' : 'Erledigt'}">` +
  `<span title="${esc(t.text)}">${esc(t.text)}</span></label><button type="button" class="kt-weg" data-kt-weg title="Löschen" aria-label="Aufgabe löschen">×</button></li>`;

// „Mein Daily“: Reiter „Offen“ (Eingabe oben, offene Aufgaben) und „Erledigt“ (Haken zurücknehmen, einzeln oder alle löschen)
export function aufgabenKachel(tasks) {
  const offen = tasks.filter(t => !t.done), fertig = tasks.filter(t => t.done);
  const neu = '<form class="kt-neu" data-kt-neu><input type="text" maxlength="140" placeholder="Neue Aufgabe …" aria-label="Neue Aufgabe" autocomplete="off">' +
    '<button type="submit" title="Hinzufügen" aria-label="Hinzufügen">+</button></form>';
  return {
    state: 'local', m: offen.length + (offen.length === 1 ? ' Aufgabe' : ' Aufgaben'), ms: offen.length + ' offen',
    x: offen.length ? offen.slice(0, 3).map(t => t.text).join(' · ') : 'Alles erledigt.',
    liste: [], startReiter: 'offen',
    kleinReiter: [
      { id: 'offen', name: 'Offen', icon: icon('list'), kopf: offen.length ? `<b>${offen.length} offen</b>${fertig.length ? ` <small>${fertig.length} erledigt</small>` : ''}` : '<b>Alles erledigt</b>',
        html: neu + (offen.length ? `<ul class="kt-liste">${offen.map(aufgabe).join('')}</ul>` : '<p class="kt-leer">Keine offenen Aufgaben. Neue oben eintragen – oder mit „+ Aufgabe“ aus Unterhaltung, Wissen, Alltag und dem Spartipp.</p>') },
      { id: 'erledigt', name: 'Erledigt', icon: icon('haken'), kopf: `<b>Erledigt</b> <small>${fertig.length}</small>`,
        html: fertig.length ? `<ul class="kt-liste">${fertig.map(aufgabe).join('')}</ul>` : '<p class="kt-leer">Noch nichts erledigt.</p>',
        unten: fertig.length ? '<button type="button" class="kt-knopf" data-kt-leeren>Erledigte löschen</button>' : '' }
    ],
    info: ['Nur in diesem Browser gespeichert', 'Haken setzen: erledigt · × löscht']
  };
}

// „Deine Nutzung“: wie oft du welche Kachel öffnest (Reiterwechsel zählen mit); unten Zähler zurücksetzen (zweimal klicken)
export function nutzungKachel(stats, titel) {
  const list = Object.entries(stats.counts).filter(([id]) => titel[id]).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((n, [, c]) => n + c, 0);
  const since = new Date(stats.start).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return {
    state: 'local', m: total + (total === 1 ? ' Klick' : ' Klicks'), ms: String(total),
    x: total ? `Seit ${since} · am häufigsten: ${titel[list[0][0]]}` : 'Öffne Kacheln. DAILY zählt hier mit, was du wirklich nutzt.',
    liste: [], startReiter: 'meist',
    kleinReiter: [{ id: 'meist', name: 'Am häufigsten', icon: icon('bars'), kopf: `<b>${total} ${total === 1 ? 'Klick' : 'Klicks'}</b> <small>seit ${esc(since)}</small>`,
      liste: list.map(([id, c]) => ({ d: `${c}×`, t: titel[id], tip: `${titel[id]}: ${c}× seit ${since} (${Math.round(c / total * 100)} %)`, gruppe: 1 })),
      html: '<p class="kt-leer">Noch keine Klicks gezählt.</p>',
      unten: total ? '<button type="button" class="kt-knopf" data-nutzung-reset>Zähler zurücksetzen</button>' : '' }],
    info: ['Nur in diesem Browser gespeichert', 'Zählt Klicks auf Kacheln und Reiter']
  };
}
