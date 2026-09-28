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

// Kachel (rein, testbar)
export function kachel(tools) {
  const liste = tools.map(t => ({ d: t.name, t: t.text, href: t.pfad, ico: icon(t.icon, 'ico tl-ico'), gruppe: 1 }));
  const html = tools.length ? `<ul class="tool-liste">${tools.map(t => `<li><a href="${esc(t.pfad)}" target="_blank" rel="noopener">` +
    `${icon(t.icon)}<span class="tool-name">${esc(t.name)}</span><span class="tool-text">${esc(t.lang)}</span><span class="tool-auf">Öffnen ↗</span></a></li>`).join('')}</ul>` +
    '<p class="note">Öffnet im neuen Tab. Die Tools arbeiten nur in deinem Browser – deine Daten bleiben in deinen Dateien auf deinem Rechner.</p>'
    : '<p class="note">Keine Tools ausgewählt – im Zahnrad-Reiter einschalten.</p>';
  return {
    state: 'local', m: '', ms: `${tools.length} Tools`,
    x: tools.length ? tools.map(t => `${t.name} (${t.text})`).join(' · ') : 'Keine Tools ausgewählt.',
    liste, tabs: [{ id: 'tools', name: 'Tools', html }]
  };
}

