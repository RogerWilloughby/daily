// Wetter über Open-Meteo (ohne Schlüssel, direkt aus dem Browser). Ort aus den Einstellungen.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { glyph, getJson } from '../core/util.js';

const WMO = { 0: 'Klar', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt', 45: 'Nebel', 48: 'Nebel mit Reif',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen', 56: 'Gefrierender Nieselregen', 57: 'Gefrierender Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Gefrierender Regen',
  71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel',
  80: 'Leichte Regenschauer', 81: 'Regenschauer', 82: 'Heftige Regenschauer', 85: 'Schneeschauer', 86: 'Starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel' };
const kind = c => c <= 1 ? 'clear' : c === 2 ? 'partly' : c === 3 ? 'cloud' : c < 50 ? 'fog' : c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : 'rain';
const r0 = Math.round;
const hhmm = iso => iso.slice(11, 16);

export function moonPhase(d = new Date()) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((d - ref) / 864e5) % syn + syn) % syn;
  return ['Neumond', 'zunehmende Sichel', 'erstes Viertel', 'zunehmender Mond', 'Vollmond', 'abnehmender Mond', 'letztes Viertel', 'abnehmende Sichel'][Math.floor((age / syn) * 8 + 0.5) % 8];
}
const aqiText = v => v == null ? null : v < 20 ? 'sehr gut' : v < 40 ? 'gut' : v < 60 ? 'mäßig' : v < 80 ? 'schlecht' : v < 100 ? 'sehr schlecht' : 'extrem schlecht';
function pollenText(c) {
  const kinds = { birch_pollen: 'Birke', grass_pollen: 'Gräser', alder_pollen: 'Erle', mugwort_pollen: 'Beifuß', ragweed_pollen: 'Ambrosia' };
  let top = null, v = 0;
  for (const k in kinds) if (c[k] != null && c[k] > v) { v = c[k]; top = kinds[k]; }
  return top === null ? 'keine' : (v < 20 ? 'gering' : v < 50 ? 'mittel' : 'hoch') + ' (' + top + ')';
}

const WX = { live: false };

export function titleFor() { return 'Wetter ' + settings.place.name; }

export async function load() {
  const P = settings.place;
  set('weather', { title: titleFor() });
  const f = `https://api.open-meteo.com/v1/forecast?latitude=${P.lat}&longitude=${P.lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day' +
    '&hourly=precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&timezone=Europe%2FBerlin&forecast_days=2';
  const a = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${P.lat}&longitude=${P.lon}` +
    '&current=european_aqi,birch_pollen,grass_pollen,alder_pollen,mugwort_pollen,ragweed_pollen&timezone=Europe%2FBerlin';
  const [w, q] = await Promise.all([getJson(f), getJson(a).catch(() => null)]);
  const c = w.current, dy = w.daily;
  const today = dy.time[0], nowH = c.time.slice(0, 13);
  let rainMax = 0, rainAt = null;
  w.hourly.time.forEach((t, k) => {
    if (t.slice(0, 10) !== today || t.slice(0, 13) < nowH) return;
    const pp = w.hourly.precipitation_probability[k];
    if (pp != null && pp > rainMax) { rainMax = pp; rainAt = t.slice(11, 13); }
  });
  Object.assign(WX, { live: true, now: r0(c.temperature_2m), text: WMO[c.weather_code] || '—', min: r0(dy.temperature_2m_min[0]), max: r0(dy.temperature_2m_max[0]), rainMax, rainAt: rainMax >= 25 ? rainAt : null });
  const qc = (q && q.current) || {};
  const air = aqiText(qc.european_aqi), pol = q && q.current ? pollenText(qc) : null;
  const rainTxt = rainMax >= 25 ? `Regen möglich, am ehesten gegen ${rainAt} Uhr.` : 'Kein Regen zu erwarten.';
  set('weather', {
    state: 'live', title: titleFor(),
    glyph: glyph(c.is_day === 0 && kind(c.weather_code) === 'clear' ? 'cloud' : kind(c.weather_code)),
    m: WX.now + '°', ms: WX.now + '°',
    x: `${WX.text}, gefühlt ${r0(c.apparent_temperature)}°. ${rainTxt}`,
    rows: [
      ['Heute', `${WX.min}° bis ${WX.max}° · ${WMO[dy.weather_code[0]] || ''}`],
      ['Regenrisiko', `bis ${rainMax} % (restlicher Tag)`],
      ['Wind', `${r0(c.wind_speed_10m)} km/h`],
      ['Sonne', `${hhmm(dy.sunrise[0])} bis ${hhmm(dy.sunset[0])}`],
      ['Mond', moonPhase()],
      ...(air ? [['Luftqualität', `${air} (EAQI ${r0(qc.european_aqi)})`]] : []),
      ...(pol ? [['Pollen', pol]] : []),
      ['Morgen', `${r0(dy.temperature_2m_min[1])}° bis ${r0(dy.temperature_2m_max[1])}° · ${WMO[dy.weather_code[1]] || ''} · Regen bis ${dy.precipitation_probability_max[1] ?? 0} %`],
      ['Stand', `${hhmm(c.time)} Uhr · Open-Meteo`]
    ]
  });
}

addAnswer(/schirm|regen|wetter|warm|kalt|grad|sonne|pollen|luft|jacke/i, () => {
  if (!WX.live) return 'Die Wetterdaten sind gerade nicht erreichbar.';
  const p = WX.rainMax, when = WX.rainAt ? ` (am ehesten gegen ${WX.rainAt} Uhr)` : '';
  const schirm = p >= 50 ? `Ja, nimm einen Schirm mit: Regenrisiko bis ${p} %${when}.`
    : p >= 25 ? `Vielleicht. Das Regenrisiko liegt bei bis zu ${p} %${when}.`
    : `Nein, eher nicht. Das Regenrisiko bleibt heute bei höchstens ${p} %.`;
  return `${settings.place.name}: jetzt ${WX.now}°, ${WX.text}. Heute ${WX.min}° bis ${WX.max}°. ${schirm}`;
});

export default { id: 'weather', name: 'Wetter', every: 30 * 60e3, load };
