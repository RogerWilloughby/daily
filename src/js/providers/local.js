// Lokale Kacheln ohne Server: „Mein Daily“ (Aufgaben) und „Deine Nutzung“ (Klickzähler).
import { set } from '../core/board.js';
import { tasks, saveTasks, stats, resetStats } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { esc } from '../core/util.js';
import { byId } from '../core/tiles.js';

// ---- Aufgaben ----
function paintTasks() {
  const open = tasks.filter(t => !t.done);
  set('tasks', {
    state: 'local',
    m: open.length + (open.length === 1 ? ' Aufgabe' : ' Aufgaben'), ms: open.length + ' offen',
    x: open.length ? open.slice(0, 3).map(t => t.text).join(' · ') : 'Alles erledigt. Neue Aufgabe? Kachel öffnen.',
    render: renderTasks
  });
}
function renderTasks(el) {
  el.innerHTML = `<form class="tasks-form"><label class="sr" for="task-new-${el.id || 'x'}">Neue Aufgabe</label>
      <input id="task-new-${el.id || 'x'}" type="text" maxlength="140" placeholder="Neue Aufgabe …" autocomplete="off"><button type="submit">Hinzufügen</button></form>
    <ul class="task-list">${tasks.map(t => `<li class="${t.done ? 'done' : ''}" data-id="${esc(t.id)}">
      <label><input type="checkbox" ${t.done ? 'checked' : ''}><span>${esc(t.text)}</span></label>
      <button type="button" class="task-del" aria-label="Aufgabe löschen">Löschen</button></li>`).join('')}</ul>
    <p class="note">Nur auf diesem Gerät gespeichert. Erledigtes bleibt durchgestrichen, bis du es löschst.</p>`;
  const input = el.querySelector('input[type=text]');
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    tasks.unshift({ id: 't' + Date.now().toString(36), text, done: false });
    saveTasks(); paintTasks();
    const again = el.querySelector('input[type=text]'); if (again) again.focus();
  });
  el.querySelectorAll('.task-list li').forEach(li => {
    const t = tasks.find(x => x.id === li.dataset.id);
    li.querySelector('input').addEventListener('change', e => { t.done = e.target.checked; saveTasks(); paintTasks(); });
    li.querySelector('.task-del').addEventListener('click', () => { tasks.splice(tasks.indexOf(t), 1); saveTasks(); paintTasks(); });
  });
}
addAnswer(/aufgabe|to-?do|erledig|mein daily/i, () => {
  const open = tasks.filter(t => !t.done);
  return open.length ? `Offen: ${open.map(t => t.text).join(', ')}.` : 'Keine offenen Aufgaben.';
});

// ---- Deine Nutzung ----
export function paintUsage() {
  const list = Object.entries(stats.counts).filter(([id]) => byId[id]).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((n, [, c]) => n + c, 0);
  const since = new Date(stats.start).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  set('usage', {
    state: 'local',
    m: total + (total === 1 ? ' Klick' : ' Klicks'), ms: String(total),
    x: total ? `Seit ${since} · am häufigsten: ${byId[list[0][0]].title}` : 'Öffne Kacheln. DAILY zählt hier mit, was du wirklich nutzt.',
    render: el => {
      el.innerHTML = (total ? `<dl>${list.slice(0, 8).map(([id, c]) => `<div class="row"><dt>${esc(byId[id].title)}</dt><dd>${c}×</dd></div>`).join('')}</dl>`
        : '<p>Noch keine Klicks gezählt.</p>') +
        `<p class="note">Seit ${esc(since)} · nur in diesem Browser gespeichert.</p><div><button type="button" class="close" data-reset style="align-self:flex-start">Zähler zurücksetzen</button></div>`;
      const b = el.querySelector('[data-reset]');
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (b.dataset.armed) { resetStats(); paintUsage(); } else { b.dataset.armed = '1'; b.textContent = 'Wirklich zurücksetzen?'; }
      });
    }
  });
}

let started = false;
document.addEventListener('daily:click', () => paintUsage());
// Aufgaben nur beim Start und nach Änderungen zeichnen (sonst gingen Eingaben verloren)
export default { id: 'local', name: 'Lokal', local: true, every: 5 * 60e3, load: async () => { if (!started) { paintTasks(); started = true; } paintUsage(); } };
