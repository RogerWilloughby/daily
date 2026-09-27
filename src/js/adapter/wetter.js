// Adapter „wetter“: macht aus dem Vertrag wetter v1 (reine Daten) die Darstellung für eine Oberfläche.
// Heute: kachel() für das Kachelraster und antwort() für „Frag DAILY“. Später z. B. liste(), dashboard().
// Ohne DOM – daher auch in Node testbar.
import { glyph } from '../core/util.js';

export const TEXT = {
  klar: 'Klar', ueberwiegend_klar: 'Überwiegend klar', teilweise_bewoelkt: 'Teilweise bewölkt', bedeckt: 'Bedeckt',
  nebel: 'Nebel', niesel: 'Nieselregen', gefrierender_niesel: 'Gefrierender Nieselregen', regen: 'Regen',
  gefrierender_regen: 'Gefrierender Regen', schnee: 'Schneefall', schneegriesel: 'Schneegriesel', regenschauer: 'Regenschauer',
  schneeschauer: 'Schneeschauer', gewitter: 'Gewitter', gewitter_hagel: 'Gewitter mit Hagel', unbekannt: '–'
};
// Stärke aus dem WMO-Code (leicht/stark) für genauere Texte
const STAERKE = { 51: 'Leichter ', 55: 'Starker ', 61: 'Leichter ', 65: 'Starker ', 71: 'Leichter ', 75: 'Starker ', 80: 'Leichte ', 82: 'Heftige ', 86: 'Starke ' };
export const zustandText = (zustand, code) => {
  const t = TEXT[zustand] || '–';
  return STAERKE[code] ? STAERKE[code] + t : t;
};
const LUFT = { gut: 'gut', ausreichend: 'ausreichend', maessig: 'mäßig', schlecht: 'schlecht', sehr_schlecht: 'sehr schlecht', extrem_schlecht: 'extrem schlecht' };
const POLLEN = { erle: 'Erle', birke: 'Birke', graeser: 'Gräser', beifuss: 'Beifuß', ambrosia: 'Ambrosia' };

const bild = (zustand, tag) => {
  const k = ['klar', 'ueberwiegend_klar'].includes(zustand) ? 'clear' : zustand === 'teilweise_bewoelkt' ? 'partly' : zustand === 'bedeckt' ? 'cloud'
    : zustand === 'nebel' ? 'fog' : zustand.startsWith('gewitter') ? 'storm' : ['schnee', 'schneegriesel', 'schneeschauer'].includes(zustand) ? 'snow' : 'rain';
  return tag === false && k === 'clear' ? 'cloud' : k; // nachts kein Sonnensymbol
};
const r0 = v => v == null ? '–' : Math.round(v);

// Hilfen für Zeiten in der Zeitzone des Orts
const zeitFmt = zone => ({
  hm: iso => iso ? new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' }) : '–',
  h: iso => new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit' }).slice(0, 2),
  tag: iso => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)),
  wtag: datum => new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' })
});

// Kennzahlen, die mehrere Darstellungen brauchen
export function auswerten(env) {
  const d = env.daten, z = zeitFmt(env.ort.zeitzone || 'Europe/Berlin');
  const heute = d.tage[0], morgen = d.tage[1];
  let regenMax = 0, regenUm = null;
  for (const s of d.stunden) {
    if (z.tag(s.zeit) !== heute.datum) break;
    if (s.regenProzent != null && s.regenProzent > regenMax) { regenMax = s.regenProzent; regenUm = z.h(s.zeit); }
  }
  let pollen = null;
  if (d.luft && d.luft.pollen) {
    const [art, wert] = Object.entries(d.luft.pollen).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0] || [];
    pollen = !art || wert < 1 ? 'keine' : `${wert < 20 ? 'gering' : wert < 50 ? 'mittel' : 'hoch'} (${POLLEN[art]})`;
  }
  return { z, heute, morgen, regenMax, regenUm: regenMax >= 25 ? regenUm : null, pollen };
}

// Darstellung als Kachel (Felder wie in core/board.js erwartet)
export function kachel(env) {
  const d = env.daten, a = d.aktuell, { z, heute, regenMax, regenUm, pollen } = auswerten(env);
  const regenText = regenMax >= 25 ? `Regen möglich, am ehesten gegen ${regenUm} Uhr.` : 'Kein Regen zu erwarten.';
  const rows = [
    ['Heute', `${r0(heute.minC)}° bis ${r0(heute.maxC)}° · ${zustandText(heute.zustand, heute.code)}`],
    ['Regenrisiko', `bis ${regenMax} % (restlicher Tag)`],
    ['Wind', `${r0(a.windKmh)} km/h${a.boeenKmh ? `, Böen ${r0(a.boeenKmh)} km/h` : ''}`],
    ['Sonne', `${z.hm(heute.sonnenaufgang)} bis ${z.hm(heute.sonnenuntergang)}${heute.uvMax != null ? ` · UV bis ${Math.round(heute.uvMax)}` : ''}`]
  ];
  if (d.luft) rows.push(['Luftqualität', `${LUFT[d.luft.stufe] || '–'} (EAQI ${r0(d.luft.aqi)})`]);
  if (pollen) rows.push(['Pollen', pollen]);
  d.tage.slice(1, 4).forEach((t, i) => rows.push([i === 0 ? 'Morgen' : z.wtag(t.datum),
    `${r0(t.minC)}° bis ${r0(t.maxC)}° · ${zustandText(t.zustand, t.code)} · Regen bis ${t.regenProzent ?? 0} %`]));
  rows.push(['Stand', `${z.hm(a.zeit)} Uhr · ${env.quellen.map(q => q.name).join(', ')}`]);
  return {
    state: 'live', title: 'Wetter ' + (env.ort.name || ''),
    glyph: glyph(bild(a.zustand, a.tag)),
    m: r0(a.tempC) + '°', ms: r0(a.tempC) + '°',
    x: `${zustandText(a.zustand, a.code)}, gefühlt ${r0(a.gefuehltC)}°. ${regenText}`,
    rows
  };
}

// Antwort für „Frag DAILY“
export function antwort(env) {
  const a = env.daten.aktuell, { heute, regenMax: p, regenUm } = auswerten(env);
  const wann = regenUm ? ` (am ehesten gegen ${regenUm} Uhr)` : '';
  const schirm = p >= 50 ? `Ja, nimm einen Schirm mit: Regenrisiko bis ${p} %${wann}.`
    : p >= 25 ? `Vielleicht. Das Regenrisiko liegt bei bis zu ${p} %${wann}.`
    : `Nein, eher nicht. Das Regenrisiko bleibt heute bei höchstens ${p} %.`;
  return `${env.ort.name || 'Hier'}: jetzt ${r0(a.tempC)}°, ${zustandText(a.zustand, a.code)}. Heute ${r0(heute.minC)}° bis ${r0(heute.maxC)}°. ${schirm}`;
}
