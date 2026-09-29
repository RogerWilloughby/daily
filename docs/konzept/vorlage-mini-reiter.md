# Vorlage: Mini-Reiter in der kleinen Kachel

Stand 29.09.2026, erstellt im Konzept-Chat. **Nicht eingespielt:** Die Umsetzung wurde auf App 0.27.0 gebaut und getestet. Weil das Repo inzwischen weiter ist (0.28.0 Arbeitsweg, 0.29.0 Radar-Karte), dient sie dem Umsetzungs-Chat als Vorlage. Die Entscheidung steht in `entscheidungen.md`, Abschnitt 13.

## Ziel
- Kacheln werden nicht mehr aufgeklappt, alles passiert in der kleinen Kachel.
- Links unter der Kopfzeile steht eine schmale Spalte mit Mini-Reitern, nur Symbole, der Name erscheint beim Überfahren. Die Kopfzeile behält die volle Breite.
- Unten in der Spalte steht ein Zahnrad. Es öffnet ein eigenes Einstellungsfenster (Dialog wie die globalen Einstellungen), kein Reiter.
- Der gewählte Reiter bleibt je Kachel gespeichert (Kachel-Einstellung `reiter`).
- Listen zeigen so viele Zeilen, wie ganz hineinpassen, ohne Scrollen und ohne halbe Zeilen.
- Handy: pausiert.

## Schnittstelle (Kachel-Feld)
```js
kleinReiter: [
  { id: 'abfahrten', name: 'Abfahrten', icon: icon('tram'), kopf: '<b>Postplatz</b>', liste: [{ d: '2 min', t: 'Tram 1 → Leutewitz', tip: '08:24 · …' }], html: '<p class="vk-text">…</p>' },
  { id: 'tanken',    name: 'Tanken',    icon: icon('fuel'), kopf: 'E10 ab <b>1,68⁹ €</b> …', liste: [...] }
],
startReiter: 'abfahrten'   // gilt, solange nichts gewählt ist
```
- `kopf`: ersetzt den Kopf der Kachel, solange dieser Reiter gewählt ist.
- `liste`: Zeilen wie die bisherige Liste der kleinen Kachel (`listeHtml`, jetzt mit optionalem `tip` → `title`).
- `html`: wird genommen, wenn `liste` fehlt oder leer ist (Hinweistexte).

## Verhalten im Raster (`core/board.js`)
- `tileHTML`: nach `.head` ein `<div class="kr" hidden></div>`, weil Knöpfe nicht in den `.head`-Knopf dürfen.
- `paint`: Mit `kleinReiter` bekommt die Kachel die Klasse `mit-kr`. Das Raster zeichnet `.kr` (Leiste und Feld), setzt den Kopf des gewählten Reiters und blendet danach per `requestAnimationFrame` die Zeilen aus, die nicht passen (`krZeilen`). Das geschieht auch bei `resize`.
- Klick auf `[data-kr]`: `kachelOptSpeichern(id, { reiter })`, dann `paint(id)`, dazu `countClick`.
- Klick auf `[data-kr-einst]`: `einstellungenOeffnen(id)`. Dabei wird ein `<dialog class="doc kachel-einst">` einmal erzeugt, mit `formular(id)` und `binden(id, body)` gefüllt, und `offeneSpeichern()` läuft beim Schließen. Das Ereignis `daily:einstellungen` zeigt im Fenster nur „Gespeichert ✓“.
- Klick irgendwo in einer `.tile.mit-kr` öffnet nichts mehr. Kacheln ohne `kleinReiter` klappen bis zu ihrer Umstellung weiter auf.

## Gemessen (Mock-Server, 0.27.0-Basis)
- **1920 und 1400 px:** Kopfzeile volle Breite, Spalte 26 px, Abfahrten 6 von 6 Zeilen, Tanken 4 von 4 Zeilen. Nichts ragt heraus, der Klick ins Feld klappt nicht auf.
- **Reiterwahl:** bleibt nach dem Neuladen erhalten.
- **Einstellungsfenster:** öffnet sich, „Diesel“ ändert den Kopf sofort („Diesel ab 1,58⁹ € Ø 1,60⁶“), Schließen funktioniert.
- **Kalender** klappt weiterhin auf.
- **Künstlich auf 70 px begrenzt:** 3 von 6 Zeilen sichtbar, der Rest ist ausgeblendet.

## Für Verkehr auf Stand 0.29.0
- Reiter Abfahrten (`tram`) · Arbeitsweg (Symbol wählen, z. B. `flag` oder `clock`) · Tanken (`fuel`), dazu das Zahnrad.
- Umschalter unten, `tabs` und `liste` der Kachel entfallen. Die Einstellung „Kleine Kachel zeigt“ entfällt, ihren alten Wert `ansicht` als `startReiter` übernehmen.
- Adapter `tanken.ansicht()`: liefert `kopf` mit Durchschnitt (`<small class="vk-schnitt">Ø …</small>`) und `liste` mit allen geöffneten Tankstellen, günstigste zuerst. Kein `html` mehr, der Test ist entsprechend angepasst.

## Code (Diff gegen 0.27.0)

### `src/js/core/board.js`
```diff
@@ -2,7 +2,7 @@
 import { TILES, byId, raster } from './tiles.js';
 import { esc, icon, rows } from './util.js';
 import { ansichtVon, erweiterungen } from './ansichten.js';
-import { countClick } from './store.js';
+import { countClick, kachelOpt, kachelOptSpeichern } from './store.js';
 import { hatEinstellungen, formular, binden, offeneSpeichern, ZAHNRAD } from './einstellungen.js';
 
 const WEIGHT = 4;
@@ -21,6 +21,7 @@
       <span class="teaser"></span>
       <span class="mini" aria-hidden="true"></span>
     </button>
+    <div class="kr" hidden></div>
     <button class="info-knopf" type="button" data-info aria-label="Info zu ${esc(t.name || t.title)}" aria-expanded="false">i</button>
     <div class="info-feld" role="tooltip" hidden></div>
     <div class="body">
@@ -67,6 +68,54 @@
   erweiterungen().forEach(x => x.nachInhalt && x.nachInhalt(el));
 }
 
+// ---- Mini-Reiter (Entscheidung 29.09.2026: Reiter in der kleinen Kachel statt Aufklappen) ----
+// t.kleinReiter: [{ id, name, icon (SVG aus eigenem Code), kopf? (HTML), liste? ([{ d, t, tip? }]), html? (wenn die Liste leer ist) }]
+// Links unter der Kopfzeile eine schmale Spalte mit Symbolen (Name beim Überfahren), rechts der Inhalt des gewählten Reiters.
+// Die Wahl bleibt je Kachel gespeichert (Kachel-Einstellung „reiter“); t.startReiter gilt, solange nichts gewählt ist.
+// Hat die Kachel Einstellungen, steht unten ein Zahnrad – es öffnet das Einstellungsfenster (kein Reiter).
+// Zeilen, die nicht mehr ganz in die Kachel passen, werden ausgeblendet (kein Scrollen, keine halben Zeilen).
+function krWahl(t) {
+  const gibt = id => t.kleinReiter.some(x => x.id === id), gespeichert = kachelOpt(t.id).reiter;
+  return gibt(gespeichert) ? gespeichert : gibt(t.startReiter) ? t.startReiter : t.kleinReiter[0].id;
+}
+function krHtml(t) {
+  const wahl = krWahl(t), r = t.kleinReiter.find(x => x.id === wahl);
+  const knopf = x => `<button type="button" role="tab" data-kr="${esc(x.id)}" aria-selected="${x.id === wahl}" title="${esc(x.name)}" aria-label="${esc(x.name)}">${x.icon || esc(x.name.slice(0, 2))}</button>`;
+  const einst = hatEinstellungen(t.id) ? `<button type="button" class="kr-einst" data-kr-einst title="Einstellungen" aria-label="Einstellungen">${ZAHNRAD}</button>` : '';
+  const inhalt = r.liste && r.liste.length ? `<div class="kr-liste">${listeHtml(r.liste)}</div>` : (r.html || '');   // leere Liste → html (Hinweistext)
+  return `<div class="kr-leiste" role="tablist" aria-label="Ansichten">${t.kleinReiter.map(knopf).join('')}${einst}</div>` +
+    `<div class="kr-feld" role="tabpanel">${inhalt}</div>`;
+}
+// Zeilen ausblenden, die unten über den Rand ragen würden
+function krZeilen(el) {
+  const feld = el.querySelector('.kr-feld'); if (!feld) return;
+  const zeilen = [...feld.querySelectorAll('.tl-z')];
+  zeilen.forEach(z => { z.hidden = false; });
+  const unten = feld.getBoundingClientRect().bottom;
+  zeilen.forEach(z => { if (z.getBoundingClientRect().bottom > unten + 0.5) z.hidden = true; });
+}
+const krAlle = () => grid.querySelectorAll('.tile.mit-kr').forEach(krZeilen);
+
+// Einstellungen einer Kachel im eigenen Fenster (statt Reiter in der aufgeklappten Kachel)
+let einstFenster = null, einstId = null;
+function einstellungenOeffnen(id) {
+  const t = byId[id]; if (!t) return;
+  if (!einstFenster) {
+    einstFenster = document.createElement('dialog');
+    einstFenster.className = 'doc kachel-einst';
+    einstFenster.innerHTML = '<div class="doc-in"><div class="doc-head"><h2></h2><button class="x" type="button" data-ke-zu>Fertig</button></div><div class="doc-body"></div></div>';
+    document.body.append(einstFenster);
+    einstFenster.addEventListener('click', e => { if (e.target === einstFenster || e.target.closest('[data-ke-zu]')) einstFenster.close(); });
+    einstFenster.addEventListener('close', () => { offeneSpeichern(); einstId = null; });
+  }
+  einstId = id;
+  einstFenster.querySelector('h2').textContent = `Einstellungen · ${t.name || t.title}`;
+  const body = einstFenster.querySelector('.doc-body');
+  body.innerHTML = formular(id);
+  binden(id, body);
+  if (typeof einstFenster.showModal === 'function' && !einstFenster.open) einstFenster.showModal();
+}
+
 // Liste für die kleine Kachel: [{ d, t, gruppe, tip? }] – zwischen Gruppen ein kleiner Abstand; tip = Text beim Überfahren
 function listeHtml(l) {
   // z.href: Zeile ist ein Link (neuer Tab, klappt die Kachel nicht auf); z.ico: Symbol-HTML davor (nur aus eigenem Code)
@@ -112,6 +161,15 @@
   el.querySelector('.head').removeAttribute('title');
   el.querySelector('.info-feld').innerHTML = [t.hover || t.name || t.title, ...(t.info || [])].map(z => `<span>${esc(z)}</span>`).join('');
   el.querySelector('.mini').innerHTML = t.chart || '';
+  // Mini-Reiter: Kopf des gewählten Reiters, Spalte mit Symbolen, Inhalt
+  const kr = el.querySelector('.kr'), mitKr = !!(t.kleinReiter && t.kleinReiter.length);
+  el.classList.toggle('mit-kr', mitKr); kr.hidden = !mitKr;
+  if (mitKr) {
+    kr.innerHTML = krHtml(t);
+    const r = t.kleinReiter.find(x => x.id === krWahl(t));
+    if (r.kopf != null) el.querySelector('.label .kopf').innerHTML = r.kopf;
+    requestAnimationFrame(() => krZeilen(el));
+  } else kr.innerHTML = '';
   erweiterungen().forEach(x => x.nachZeichnen && x.nachZeichnen(el));
   el.querySelector('.head').setAttribute('aria-label', [t.title, t.lglyphTip, t.m].filter(Boolean).join(': '));
   // Aufgeklappten Inhalt nur neu zeichnen, wenn er sichtbar ist – und nicht, während die Einstellungen offen sind (Eingaben bleiben)
@@ -194,6 +252,10 @@
 // Der Zahnrad-Reiter selbst bleibt stehen – sonst spränge beim Tippen der Cursor aus dem Feld.
 document.addEventListener('daily:einstellungen', e => {
   const id = e.detail, t = byId[id]; if (!t) return;
+  if (einstId === id && einstFenster) {                // Einstellungsfenster: nur kurz bestätigen, das Formular bleibt stehen
+    const ok = einstFenster.querySelector('.ke-ok');
+    if (ok) { ok.textContent = 'Gespeichert ✓'; clearTimeout(ok._t); ok._t = setTimeout(() => { ok.textContent = ''; }, 2000); }
+  }
   const ziele = [active === id && document.querySelector(`#tile-${id} .content`), open === id && document.getElementById('s-content')].filter(Boolean);
   ziele.forEach(el => {
     const alt = el.querySelector(`:scope > [data-feld="${EINST}"]`);
@@ -213,7 +275,7 @@
   const zeiger = e => erweiterungen().forEach(x => x.zeiger && x.zeiger(e, grid));
   grid.addEventListener('pointermove', zeiger);
   grid.addEventListener('pointerleave', zeiger);
-  addEventListener('resize', () => requestAnimationFrame(() => { rasterNeu(); erweiterungen().forEach(x => x.groesse && x.groesse(grid)); }));
+  addEventListener('resize', () => requestAnimationFrame(() => { rasterNeu(); erweiterungen().forEach(x => x.groesse && x.groesse(grid)); krAlle(); }));
   ORDER = TILES.map(t => t.id);
   grid.innerHTML = TILES.map(tileHTML).join('');
   TILES.forEach(t => paint(t.id));
@@ -230,6 +292,17 @@
     if (k) { k.classList.toggle('fest'); info(k, k.classList.contains('fest')); }
   });
   grid.addEventListener('click', e => {
+    // Mini-Reiter: Wechsel sofort und gespeichert; Zahnrad öffnet das Einstellungsfenster; die Kachel klappt nicht auf
+    const kr = e.target.closest('[data-kr]'), ke = e.target.closest('[data-kr-einst]');
+    if (kr || ke) {
+      const id = e.target.closest('.tile').id.replace(/^tile-/, '');
+      if (ke) { einstellungenOeffnen(id); return; }
+      countClick(id); document.dispatchEvent(new CustomEvent('daily:click', { detail: id }));
+      kachelOptSpeichern(id, { reiter: kr.dataset.kr });
+      paint(id);
+      return;
+    }
+    if (e.target.closest('.tile.mit-kr')) return;          // Kacheln mit Mini-Reitern werden nicht mehr aufgeklappt
     if (e.target.closest('[data-info], [data-mini-wahl], a[href]')) return;   // (i), Diagramm-Umschalter und Links öffnen die Kachel nicht
     if (e.target.closest('[data-close]')) { activate(null); return; }
     const head = e.target.closest('.head'); if (!head) return;
```

### `src/app.css` (am Ende)
```css
/* Mini-Reiter : Reiter in der kleinen Kachel statt Aufklappen – links eine Spalte mit Symbolen, rechts der Inhalt */
.tile.mit-kr{grid-template-rows:auto minmax(0,1fr)}
.tile.mit-kr .head{padding-bottom:6px;cursor:default}
.tile.mit-kr .head :is(.teaser,.mini,.metric){display:none}
.kr[hidden]{display:none}
.kr{display:grid;grid-template-columns:26px minmax(0,1fr);column-gap:10px;min-height:0;overflow:hidden;padding:0 20px 14px 14px}
.kr-leiste{display:flex;flex-direction:column;gap:4px;min-height:0}
.kr-leiste button{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:7px;
  background:transparent;color:var(--muted);cursor:pointer;padding:0}
.kr-leiste button .ico{width:16px;height:16px}
.kr-leiste button:hover{color:var(--ink);border-color:var(--line)}
.kr-leiste button[aria-selected="true"]{color:var(--accent);background:var(--line)}
.kr-leiste .kr-einst{margin-top:auto}
.kr-feld{min-width:0;min-height:0;overflow:hidden;font-size:13px;line-height:1.35}
.kr-liste{display:flex;flex-direction:column;gap:2px}
.kr-liste .tl-z[hidden]{display:none}
```

### `src/js/providers/verkehr.js`
```diff
@@ -1,17 +1,15 @@
 // Kachel „Verkehr“: Abfahrten (vorerst /api/transit, VVO – Umzug auf daily/1 folgt) und Tanken (Dienst „tanken“, daily/1).
-// Später kommt der Arbeitsweg dazu. Die kleine Kachel zeigt eine Ansicht, der Umschalter wechselt sofort ohne Abruf.
+// Später kommt der Arbeitsweg dazu. Mini-Reiter in der kleinen Kachel (links: Abfahrten, Tanken, Zahnrad); kein Aufklappen.
 import { set } from '../core/board.js';
 import { settings, saveSettings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
 import { kachelEinstellungen } from '../core/einstellungen.js';
 import { addAnswer } from '../core/ask.js';
 import { dienst, gespeichert, ortParams } from '../dienste/client.js';
 import { ansicht as tankAnsicht, antwort as tankAntwort, sorteVon, SORTE_NAME, UMKREISE } from '../adapter/tanken.js';
-import { umschalter } from '../adapter/diagramm.js';
-import { hm, getJson, esc } from '../core/util.js';
+import { hm, getJson, esc, icon } from '../core/util.js';
 
 const ID = 'verkehr';
-export const VERKEHR_STANDARD = { ansicht: 'abfahrten', umkreis: 5 };
-const WAHL = [['abfahrten', 'Abfahrten'], ['tanken', 'Tanken']];
+export const VERKEHR_STANDARD = { umkreis: 5 };
 const opt = () => kachelOpt(ID, VERKEHR_STANDARD);
 const umkreis = () => (UMKREISE.includes(+opt().umkreis) ? +opt().umkreis : 5);
 const tankParams = () => ({ ...ortParams(settings.place), umkreis: umkreis() });
@@ -24,50 +22,51 @@
 // „Tram 1“, „Bus 62“, „S1“ – Verkehrsmittel vor die Liniennummer
 const lineLabel = d => /^[A-Z]/.test(d.line) ? d.line : /bus/i.test(d.mot) ? `Bus ${d.line}` : /tram/i.test(d.mot) ? `Tram ${d.line}` : d.line;
 const kommende = () => (ab && ab.found ? ab.departures.filter(d => Date.parse(d.time) > Date.now() - 60000) : []);
+const text = t => `<p class="vk-text">${esc(t)}</p>`;
 
-function abfahrtenAnsicht() {
-  if (!ab) return { kopf: 'Abfahrten', m: '', ms: '–', x: 'Die Abfahrten sind gerade nicht verfügbar.', liste: [], html: '<p>Die Abfahrten sind gerade nicht verfügbar.</p>' };
+function abfahrten() {
+  if (!ab) return { kopf: 'Abfahrten', ms: '–', x: 'Die Abfahrten sind gerade nicht verfügbar.', html: text('Die Abfahrten sind gerade nicht verfügbar.') };
   if (!ab.found) {
-    const t = `Haltestelle „${settings.stop}“ wurde nicht gefunden. In den Einstellungen der Kachel (Zahnrad) anpassen – vorerst nur Verkehrsverbund Oberelbe (Dresden und Umgebung).`;
-    return { kopf: 'Haltestelle wählen', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
+    const t = `Haltestelle „${settings.stop}“ wurde nicht gefunden. Im Zahnrad anpassen – vorerst nur Verkehrsverbund Oberelbe (Dresden und Umgebung).`;
+    return { kopf: 'Haltestelle wählen', ms: '–', x: t, html: text(t) };
   }
   const deps = kommende(), first = deps[0];
-  const rows = deps.slice(0, 12).map(d => `<div class="row"><dt>${esc(hm(d.time))}${d.delay > 0 ? ` <small class="vk-spaet">+${d.delay}</small>` : ''}</dt>` +
-    `<dd>${esc(lineLabel(d))} → ${esc(d.direction)}${d.platform ? ` · <small>${esc(d.platform)}</small>` : ''}</dd></div>`).join('');
+  if (!first) return { kopf: `<b>${esc(ab.stop.name)}</b>`, ms: '–', x: 'Gerade keine Abfahrten.', html: text('In der nächsten Zeit keine Abfahrten.') };
   return {
     kopf: `<b>${esc(ab.stop.name)}</b>`,
-    m: first ? `${lineLabel(first)} ${inTxt(first.time)}` : 'Keine Abfahrt', ms: first ? (mins(first.time) ? `${mins(first.time)} min` : 'jetzt') : '–',
-    x: deps.slice(0, 3).map(d => `${lineLabel(d)} → ${d.direction} ${inTxt(d.time)}`).join(' · ') || 'Gerade keine Abfahrten.',
-    liste: deps.slice(0, 3).map(d => ({ d: inTxt(d.time).replace('in ', ''), t: `${lineLabel(d)} → ${d.direction}`,
-      tip: `${hm(d.time)}${d.delay > 0 ? ` (+${d.delay} min)` : ''} · ${lineLabel(d)} → ${d.direction}${d.platform ? ' · ' + d.platform : ''}`, gruppe: 1 })),
-    html: `<p class="vk-hinweis">${esc(ab.stop.name)} · Echtzeit, soweit verfügbar</p><dl class="kompakt">${rows || '<div class="row"><dd>In der nächsten Zeit keine Abfahrten.</dd></div>'}</dl>` +
-      '<p class="vk-quelle">Quelle: VVO (Verkehrsverbund Oberelbe)</p>'
+    ms: mins(first.time) ? `${mins(first.time)} min` : 'jetzt',
+    x: deps.slice(0, 3).map(d => `${lineLabel(d)} → ${d.direction} ${inTxt(d.time)}`).join(' · '),
+    // so viele, wie in die Kachel passen (das Raster blendet den Rest aus); Überfahren: Uhrzeit, Verspätung, Steig
+    liste: deps.slice(0, 12).map(d => ({ d: inTxt(d.time).replace('in ', ''), t: `${lineLabel(d)} → ${d.direction}${d.delay > 0 ? ` (+${d.delay})` : ''}`,
+      tip: `${hm(d.time)}${d.delay > 0 ? ` (+${d.delay} min)` : ''} · ${lineLabel(d)} → ${d.direction}${d.platform ? ' · ' + d.platform : ''}`, gruppe: 1 }))
   };
 }
 
 // ---- Tanken (Dienst „tanken“) ----
-function tankenAnsicht() {
+function tanken() {
   if (tkFehler && tkFehler.code === 'schluessel_fehlt' && !tk) {
     const t = 'Für Spritpreise braucht DAILY einen kostenlosen Tankerkönig-Schlüssel (Betreiber, einmalig): onboarding.tankerkoenig.de, dann Vercel-Variable TANKERKOENIG_API_KEY.';
-    return { kopf: 'Tanken einrichten', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
+    return { kopf: 'Tanken einrichten', ms: '–', x: t, html: text(t) };
   }
   if (tkFehler && tkFehler.code === 'nicht_unterstuetzt' && !tk) {
     const t = 'Spritpreise gibt es nur für Orte in Deutschland.';
-    return { kopf: 'Tanken', m: '', ms: '–', x: t, liste: [], html: `<p>${esc(t)}</p>` };
+    return { kopf: 'Tanken', ms: '–', x: t, html: text(t) };
   }
-  return tankAnsicht(tk, sorteVon(settings.fuel));
+  const a = tankAnsicht(tk, sorteVon(settings.fuel));
+  return a.liste.length ? a : { ...a, html: text(a.x) };
 }
 
-// ---- Kachel zusammensetzen ----
+// ---- Kachel zusammensetzen: Mini-Reiter (core/board.js), gewählter Reiter wird dort gespeichert ----
 function zeichne() {
-  const wahl = WAHL.some(([w]) => w === opt().ansicht) ? opt().ansicht : 'abfahrten';
-  const teile = { abfahrten: abfahrtenAnsicht(), tanken: tankenAnsicht() }, a = teile[wahl];
+  const ab1 = abfahrten(), tk1 = tanken();
   set(ID, {
-    // keine große Zeile: Kopf + Liste (wie Finanzen); am Handy die Kurzform ms
-    state: ab || tk ? 'live' : 'error', title: 'Verkehr', kopf: a.kopf, m: '', ms: a.ms, x: a.x, liste: a.liste,
-    chart: `<div class="vk-fuss">${umschalter(wahl, WAHL)}</div>`,
-    tabs: WAHL.map(([id, name]) => ({ id, name, html: teile[id].html })), startReiter: wahl,
-    tag: tk && tk.veraltet && wahl === 'tanken' ? 'Stand ' + hm(tk.erstellt) : ''
+    state: ab || tk ? 'live' : 'error', title: 'Verkehr', m: '', ms: ab1.ms, x: ab1.x, liste: [],
+    kleinReiter: [
+      { id: 'abfahrten', name: 'Abfahrten', icon: icon('tram'), kopf: ab1.kopf, liste: ab1.liste, html: ab1.html },
+      { id: 'tanken', name: 'Tanken', icon: icon('fuel'), kopf: tk1.kopf, liste: tk1.liste, html: tk1.html }
+    ],
+    startReiter: opt().ansicht,   // früher gespeicherte Ansicht (0.27.0), bis ein Reiter gewählt wird
+    info: ['Abfahrten: VVO', 'Tanken: Tankerkönig (CC BY 4.0), MTS-K', ...(tk && tk.veraltet ? ['Tankpreise Stand ' + hm(tk.erstellt)] : [])]
   });
 }
 
@@ -83,13 +82,6 @@
   zeichne();
 }
 
-// Umschalter in der kleinen Kachel: dieselbe Einstellung wie „Beim Öffnen zeigen“ im Zahnrad-Reiter, sofort ohne Abruf
-document.addEventListener('click', e => {
-  const b = e.target.closest(`#tile-${ID} [data-mini-wahl]`); if (!b) return;
-  kachelOptSpeichern(ID, { ansicht: b.dataset.miniWahl });
-  zeichne();
-});
-
 // Frag DAILY
 addAnswer(/tank|benzin|diesel|sprit|super|\be10\b|\be5\b/i, q => tankAntwort(q, tk, settings.fuel));
 addAnswer(/bus|bahn|tram|straßenbahn|strassenbahn|abfahrt|haltestelle|öpnv|oepnv/i, () => {
@@ -101,7 +93,6 @@
 // Einstellungen der Kachel (Zahnrad-Reiter)
 kachelEinstellungen(ID, {
   felder: () => [
-    { typ: 'select', key: 'ansicht', label: 'Kleine Kachel zeigt', wert: opt().ansicht, optionen: WAHL },
     { typ: 'titel', label: 'Abfahrten' },
     { typ: 'text', key: 'stop', label: 'Haltestelle', wert: settings.stop || '', platzhalter: 'z. B. Postplatz', hilfe: 'Vorerst Verkehrsverbund Oberelbe (Dresden und Umgebung); weitere Verbünde folgen.' },
     { typ: 'titel', label: 'Tanken' },
@@ -111,7 +102,7 @@
   speichern: w => {
     const stopNeu = (w.stop || '').trim() || 'Postplatz', umkreisNeu = +w.umkreis !== umkreis();
     saveSettings({ stop: stopNeu, fuel: sorteVon(w.fuel) });
-    kachelOptSpeichern(ID, { ansicht: w.ansicht, umkreis: +w.umkreis });
+    kachelOptSpeichern(ID, { umkreis: +w.umkreis });
     if (umkreisNeu) tk = gespeichert('tanken', tankParams()) || null;
     zeichne();
     load().catch(() => {});
```

### `src/css/verkehr.css` (neu gefasst)
```css
/* DAILY – Kachel „Verkehr“ (Abfahrten, Tanken): Inhalte der Mini-Reiter (Reiterspalte: allgemein in app.css, .kr-*). */
.vk-text{margin:0;color:var(--muted);font-size:13px;line-height:1.4}
.vk-schnitt{font-weight:500;color:var(--muted);margin-left:4px}
```
