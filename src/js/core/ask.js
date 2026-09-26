// „Frag DAILY“: Anbieter melden Muster und Antwortfunktionen an.
// Später kann hier eine KI-Antwort über alle Kacheldaten ergänzt werden.
import { esc } from './util.js';

const answers = [];
export function addAnswer(pattern, fn) { answers.push([pattern, fn]); }

const box = document.getElementById('answer');
export const answerOpen = () => !box.hidden;
export const closeAnswer = () => { box.hidden = true; };

export function initAsk() {
  document.getElementById('ask').addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById('q').value.trim(); if (!q) return;
    const hit = answers.find(([re]) => re.test(q));
    let txt = hit ? hit[1](q) : null;
    if (!txt) txt = 'Darauf habe ich noch keine Antwort. Frag zum Beispiel nach Wetter, Terminen, Schlagzeilen, DAX, Dynamo, Abfahrten, Rezept, Rätsel oder deinen Aufgaben.';
    document.getElementById('answer-text').innerHTML = `<span class="q">${esc(q)}</span>${esc(txt)}`;
    box.hidden = false;
  });
  document.getElementById('answer-close').onclick = closeAnswer;
}
