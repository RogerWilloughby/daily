// Adapter für den Katalog (GET /api/v1/dienste): Seite „Woher kommen die Daten?“ – ohne DOM, liefert HTML-Text.
import { esc } from '../core/util.js';

const li = x => (Array.isArray(x) ? x : [x]).map(z => `<li>${esc(z)}</li>`).join('');
const quelle = q => `${q.url ? `<a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.name)}</a>` : esc(q.name)}${q.lizenz ? ` <small>(${esc(q.lizenz)})</small>` : ''}`;

export function seite(env) {
  const dienste = (env && env.daten && env.daten.dienste) || [];
  if (!dienste.length) return '<p>Keine Angaben verfügbar.</p>';
  return dienste.map(d => {
    const b = d.blatt || {};
    return `<section class="blatt">
      <h3>${esc(d.titel)}</h3>
      <p>${esc(b.zweck || d.beschreibung)}</p>
      <p><b>Quellen:</b> ${d.quellen.map(quelle).join(', ')}</p>
      ${b.herkunft ? `<ul>${li(b.herkunft)}</ul>` : ''}
      ${b.verarbeitung ? `<details><summary>So verarbeitet DAILY die Daten</summary><ul>${li(b.verarbeitung)}</ul></details>` : ''}
    </section>`;
  }).join('');
}
