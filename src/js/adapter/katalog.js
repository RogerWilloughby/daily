// Adapter für den Katalog (GET /api/v1/dienste): Seite „Woher kommen die Daten?“ – ohne DOM, liefert HTML-Text.
import { esc } from '../core/util.js';
import { GENUTZTE_DIENSTE } from '../core/betrieb.js';

const li = x => (Array.isArray(x) ? x : [x]).map(z => `<li>${esc(z)}</li>`).join('');
const quelle = q => `${q.url ? `<a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.name)}</a>` : esc(q.name)}${q.lizenz ? ` <small>(${esc(q.lizenz)})</small>` : ''}`;

// app: Version der Oberfläche (core/version.js); env.daten.app: Version des Servers.
// Nur Dienste, die die Oberfläche abruft (core/betrieb.js) – Dienste, die nur auf dem Server laufen, erscheinen hier nicht.
export function seite(env, appText = '') {
  const dienste = ((env && env.daten && env.daten.dienste) || []).filter(d => GENUTZTE_DIENSTE.includes(d.id));
  if (!dienste.length) return '<p>Keine Angaben verfügbar.</p>';
  const srv = env.daten.app;
  const kopf = appText || srv ? `<p class="versionen">${esc(appText)}${srv ? ` <small>· Server ${esc(srv.version)}${srv.commit ? ' · ' + esc(srv.commit) : ''}</small>` : ''}</p>` : '';
  return kopf + dienste.map(d => {
    const b = d.blatt || {};
    const letzte = (d.aenderungen || [])[0];
    return `<section class="blatt">
      <h3>${esc(d.titel)} <small class="dversion">${esc(d.id)} ${esc(d.programmversion || '')}</small></h3>
      <p>${esc(b.zweck || d.beschreibung)}</p>
      <p><b>Quellen:</b> ${d.quellen.map(quelle).join(', ')}</p>
      ${b.herkunft ? `<ul>${li(b.herkunft)}</ul>` : ''}
      ${b.verarbeitung ? `<details><summary>So verarbeitet DAILY die Daten</summary><ul>${li(b.verarbeitung)}</ul></details>` : ''}
      ${letzte ? `<details><summary>Änderungen (zuletzt ${esc(letzte.version)})</summary><ul>${(d.aenderungen || []).map(a => `<li>${esc(a.version)} · ${esc(a.text)}</li>`).join('')}</ul></details>` : ''}
    </section>`;
  }).join('');
}
