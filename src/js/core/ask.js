// „Frag DAILY“: Anbieter melden Muster und Antwortfunktionen an.
// Später kann hier eine KI-Antwort über alle Kacheldaten ergänzt werden.
import { esc } from './util.js';

const answers = [];
export function addAnswer(pattern, fn) { answers.push([pattern, fn]); }

const box = document.getElementById('answer');
export const answerOpen = () => !box.hidden;
export const closeAnswer = () => { box.hidden = true; };

export function initAsk() {
  document.getElementById('ask').addEventListener('submit', async e => {
    e.preventDefault();
    const q = document.getElementById('q').value.trim(); if (!q) return;
    // erste passende Antwort, die etwas liefert (sonst die nächste passende)
    let txt = null;
    // Antworten dürfen auch später kommen (Promise), z. B. wenn erst ein Dienst gefragt wird
    for (const [re, fn] of answers) { if (re.test(q)) { try { txt = await fn(q); } catch (err) { txt = null; } if (txt) break; } }
    if (txt) txt = txt.replace(/\.\.$/, '.');
    if (!txt) txt = 'Darauf habe ich noch keine Antwort. Frag zum Beispiel nach Wetter, Regen, Ferien, Vollmond oder „Wann hat Josef Namenstag?“.';
    document.getElementById('answer-text').innerHTML = `<span class="q">${esc(q)}</span>${esc(txt)}`;
    box.hidden = false;
  });
  document.getElementById('answer-close').onclick = closeAnswer;
}
