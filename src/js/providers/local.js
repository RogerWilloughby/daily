// Lokale Kacheln ohne Server: „Mein Daily“ (Aufgaben) und „Deine Nutzung“ (Klickzähler) – seit 0.38.0 mit Mini-Reitern (adapter/lokal.js).
import { set } from '../core/board.js';
import { tasks, saveTasks, stats, resetStats } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { byId } from '../core/tiles.js';
import { aufgabenKachel, nutzungKachel } from '../adapter/lokal.js';

// ---- Aufgaben ----
let fokus = false;   // nach „Hinzufügen“ bleibt der Cursor im Eingabefeld
function paintTasks() {
  set('tasks', aufgabenKachel(tasks));
  if (fokus) requestAnimationFrame(() => { const i = document.querySelector('#tile-tasks [data-kt-neu] input'); if (i) i.focus(); });
}
const T = '#tile-tasks';
document.addEventListener('submit', e => {
  const f = e.target.closest(`${T} [data-kt-neu]`); if (!f) return;
  e.preventDefault();
  const text = f.querySelector('input').value.trim(); if (!text) return;
  tasks.unshift({ id: 't' + Date.now().toString(36), text: text.slice(0, 140), done: false });
  fokus = true; saveTasks(); paintTasks(); fokus = false;
});
document.addEventListener('change', e => {
  const li = e.target.closest(`${T} [data-kt]`); if (!li || e.target.type !== 'checkbox') return;
  const t = tasks.find(x => x.id === li.dataset.kt); if (!t) return;
  t.done = e.target.checked; saveTasks(); paintTasks();
});
document.addEventListener('click', e => {
  const weg = e.target.closest(`${T} [data-kt-weg]`), leeren = e.target.closest(`${T} [data-kt-leeren]`);
  if (weg) { const i = tasks.findIndex(x => x.id === weg.closest('[data-kt]').dataset.kt); if (i >= 0) { tasks.splice(i, 1); saveTasks(); paintTasks(); } }
  if (leeren) {
    if (!leeren.dataset.armed) { leeren.dataset.armed = '1'; leeren.textContent = 'Wirklich alle löschen?'; return; }
    for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].done) tasks.splice(i, 1);
    saveTasks(); paintTasks();
  }
});
// Aufgaben aus anderen Kacheln (z. B. „+ Aufgabe“ bei den Tagesinhalten) → neu zeichnen
document.addEventListener('daily:aufgaben', () => paintTasks());
addAnswer(/aufgabe|to-?do|erledig|mein daily/i, () => {
  const open = tasks.filter(t => !t.done);
  return open.length ? `Offen: ${open.map(t => t.text).join(', ')}.` : 'Keine offenen Aufgaben.';
});

// ---- Deine Nutzung ----
export function paintUsage() { set('usage', nutzungKachel(stats, Object.fromEntries(Object.values(byId).map(t => [t.id, t.title])))); }
document.addEventListener('click', e => {
  const b = e.target.closest('#tile-usage [data-nutzung-reset]'); if (!b) return;
  if (b.dataset.armed) { resetStats(); paintUsage(); } else { b.dataset.armed = '1'; b.textContent = 'Wirklich zurücksetzen?'; }
});

let started = false;
// Nutzung nicht bei jedem Klick neu zeichnen, solange der Zurücksetzen-Knopf „scharf“ ist
document.addEventListener('daily:click', () => { if (!document.querySelector('#tile-usage [data-nutzung-reset][data-armed]')) paintUsage(); });
// Aufgaben nur beim Start und nach Änderungen zeichnen (sonst gingen Eingaben verloren)
export default { id: 'local', name: 'Lokal', local: true, every: 5 * 60e3, load: async () => { if (!started) { paintTasks(); started = true; } paintUsage(); } };
