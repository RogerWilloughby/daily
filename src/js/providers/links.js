// „Meine Seiten“: Links zu den eigenen Portalen (Mail, Nachrichten, Kalender …).
// DAILY zeigt keine fremden Inhalte – nur die Links, gespeichert auf diesem Gerät.
import { set } from '../core/board.js';
import { links, saveLinks } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { esc } from '../core/util.js';
import { cleanUrl } from '../lib/url.js';

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

function paint() {
  set('links', {
    state: 'local', m: links.length === 1 ? '1 Seite' : links.length + ' Seiten', ms: String(links.length),
    x: links.length ? links.map(l => l.name).join(' · ') : 'Lege deine Mail-, Nachrichten- oder Kalenderseite hier ab.',
    render
  });
}

function render(el) {
  el.innerHTML = `<ul class="link-list">${links.map(l => `<li data-id="${esc(l.id)}">
      <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="link-name">${esc(l.name)}</span><span class="link-host">${esc(host(l.url))}</span></a>
      <button type="button" class="task-del" aria-label="${esc(l.name)} entfernen">Entfernen</button></li>`).join('')}</ul>
    <form class="tasks-form links-form">
      <label class="sr" for="link-name">Name</label><input id="link-name" type="text" maxlength="40" placeholder="Name, z. B. Spiegel" autocomplete="off">
      <label class="sr" for="link-url">Adresse</label><input id="link-url" type="text" maxlength="300" placeholder="spiegel.de" autocomplete="off" inputmode="url">
      <button type="submit">Hinzufügen</button></form>
    <p class="note" data-msg>Öffnet in einem neuen Tab. Nur auf diesem Gerät gespeichert.</p>`;
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const url = cleanUrl(el.querySelector('#link-url').value);
    if (!url) { el.querySelector('[data-msg]').textContent = 'Bitte eine gültige Adresse eingeben, z. B. spiegel.de'; return; }
    const name = el.querySelector('#link-name').value.trim() || host(url);
    links.push({ id: 'l' + Date.now().toString(36), name, url });
    saveLinks(); paint();
  });
  el.querySelectorAll('.link-list li').forEach(li => {
    li.querySelector('button').addEventListener('click', () => {
      const i = links.findIndex(l => l.id === li.dataset.id);
      if (i >= 0) { links.splice(i, 1); saveLinks(); paint(); }
    });
  });
}

addAnswer(/seite|link|portal|lesezeichen/i, () => links.length ? `Deine Seiten: ${links.map(l => l.name).join(', ')}. Öffne die Kachel „Meine Seiten“.` : 'Noch keine Seiten gespeichert.');

let started = false;
export default { id: 'links', name: 'Meine Seiten', local: true, every: 60 * 60e3, load: async () => { if (!started) { paint(); started = true; } } };
