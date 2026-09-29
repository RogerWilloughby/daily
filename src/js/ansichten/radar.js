// Radarkarte im Reiter „Radar“ (adapter/regen.js): Bilder laufen von selbst (ein Bild je 15 Minuten, −60 min bis +2 Std.),
// die Zeitleiste darunter hält an oder springt zu einem Zeitpunkt. Ohne Skript bleibt das Bild „jetzt“ stehen.
// Gilt für jede Radarkarte in einer aufgeklappten Kachel oder im Handy-Vollbild.
import { erweiterung } from '../core/ansichten.js';

const TAKT_MS = 900, PAUSE_AM_ENDE = 2;   // am letzten Bild zwei Takte stehen bleiben

function zeige(karte, i) {
  karte.dataset.i = String(i);
  karte.querySelectorAll('.rk-bild').forEach(g => g.classList.toggle('rk-an', +g.dataset.i === i));
  karte.querySelectorAll('[data-rk-bild]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.rkBild === i)));
  const b = karte.querySelector(`[data-rk-bild="${i}"]`), uhr = karte.querySelector('.rk-uhr');
  if (b && uhr) uhr.textContent = b.title;
}
function halte(karte, an) {
  karte.dataset.halt = an ? '1' : '';
  const s = karte.querySelector('.rk-start');
  if (s) { s.textContent = an ? '▶' : '❚❚'; s.title = an ? 'Abspielen' : 'Anhalten'; s.setAttribute('aria-label', s.title); }
}

function starte(karte) {
  if (karte._rk) return;
  const n = karte.querySelectorAll('.rk-bild').length;
  if (!n) return;
  const l = karte.querySelector('.rk-leiste');
  zeige(karte, +(l && l.dataset.jetzt) || 0);
  halte(karte, typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let warte = 0;
  karte._rk = setInterval(() => {
    if (!karte.isConnected) { clearInterval(karte._rk); return; }
    if (karte.dataset.halt === '1' || karte.closest('[hidden]')) return;
    const i = +karte.dataset.i;
    if (i === n - 1 && warte < PAUSE_AM_ENDE) { warte++; return; }
    warte = 0;
    zeige(karte, (i + 1) % n);
  }, TAKT_MS);
  karte.addEventListener('click', e => {
    const b = e.target.closest('[data-rk-bild], .rk-start');
    if (!b) return;
    e.stopPropagation();
    if (b.classList.contains('rk-start')) halte(karte, karte.dataset.halt !== '1');
    else { halte(karte, true); zeige(karte, +b.dataset.rkBild); }
  });
}

erweiterung({ nachInhalt(el) { el.querySelectorAll('.rk-karte').forEach(starte); } });
