import { esc, icon } from '../core/util.js';

// Verzeichnis der Tools (Kachel „Tools“). Ein Tool ist eine eigenständige Seite in src/tools/, die im neuen Tab öffnet.
// Neues Tool: Datei nach src/tools/ legen (Schriften von DAILY, kein Google Fonts), hier eine Zeile ergänzen und in src/sw.js aufnehmen.
// Die Tools arbeiten nur im Browser mit Dateien auf dem eigenen Rechner – keine Daten an DAILY oder Dritte.
export const TOOLS = [
  { id: 'arbeitszeit', name: 'Arbeitszeit', text: 'Gleitzeit & Monatsübersicht', pfad: '/tools/arbeitszeit.html', icon: 'clock',
    lang: 'Arbeitszeiten erfassen, Gleitzeitkonto, Urlaub/Krank/Feiertag, CSV-Import und -Export, Drucken. Speichert in eine Datei auf deinem Rechner.' },
  { id: 'setzkasten', name: 'Setzkasten', text: 'HTML- und Markdown-Editor', pfad: '/tools/setzkasten.html', icon: 'doc',
    lang: 'HTML- und Markdown-Dateien öffnen, bearbeiten, umwandeln und als PDF drucken. Speichert als Download, merkt sich nichts im Browser.' }
];

// Kachel (rein, testbar): Mini-Reiter (seit 0.38.0) „Alle“ (Liste, ein Klick öffnet) und je Tool ein Reiter mit Beschreibung und „Öffnen ↗“
export function kachel(tools) {
  const liste = tools.map(t => ({ d: t.name, t: t.text, href: t.pfad, ico: icon(t.icon, 'ico tl-ico'), tip: t.lang, gruppe: 1 }));
  return {
    state: 'local', m: '', ms: `${tools.length} Tools`,
    x: tools.length ? tools.map(t => `${t.name} (${t.text})`).join(' · ') : 'Keine Tools ausgewählt.',
    liste: [], startReiter: 'alle',
    kleinReiter: [
      { id: 'alle', name: 'Alle Tools', icon: icon('tool'), kopf: `<b>Tools</b> <small>${tools.length}</small>`, liste,
        html: '<p class="kt-leer">Keine Tools ausgewählt – im Zahnrad einschalten.</p>' },
      // Knopf unten (bekommt zuerst seinen Platz), die Beschreibung darüber wird bei wenig Höhe gekürzt
      ...tools.map(t => ({ id: t.id, name: t.name, icon: icon(t.icon), kopf: `<b>${esc(t.name)}</b>`,
        html: `<p class="kt-text" title="${esc(t.lang)}"><b>${esc(t.text)}.</b> ${esc(t.lang)}</p>`,
        unten: `<a class="kt-knopf" href="${esc(t.pfad)}" target="_blank" rel="noopener">${esc(t.name)} öffnen ↗</a>` }))
    ],
    info: ['Öffnet im neuen Tab', 'Die Tools arbeiten nur in deinem Browser – deine Daten bleiben in deinen Dateien']
  };
}

