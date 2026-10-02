// Adapter „fussball“: macht aus der Antwort des Dienstes „fussball“ (eine Liga) die Kachel „Sport“ für den eigenen Verein
// und die Antwort für „Frag DAILY“. Den Verein sucht die Oberfläche selbst in der Liga-Antwort (der Dienst kennt ihn nicht).
// Ohne DOM, testbar. Mini-Reiter (seit 0.43.0): Verein · Tabelle · Spieltag, Zahnrad.
import { esc, icon } from '../core/util.js';

export const LIGEN = ['bl1', 'bl2', 'bl3'];
const SYM = { verein: 'ball', tabelle: 'bars', spieltag: 'cal' };
const ERG = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

// Kleinbuchstaben, ß → ss, Umlaute als ae/oe/ue (lang) oder a/o/u (kurz) – „Muenchen“ und „Munchen“ finden „München“;
// alle Wörter ab 3 Zeichen müssen im Namen vorkommen (wie früher api/sport.js)
const grund = s => String(s || '').toLowerCase().replace(/ß/g, 'ss');
const rest = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const norm = (s, kurz = false) => rest(kurz ? grund(s) : grund(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue'));
const passt = (name, suche) => [false, true].some(kurz => {
  const n = norm(name, kurz), w = norm(suche, kurz).split(' ').filter(x => x.length > 2);
  return w.length > 0 && w.every(x => n.includes(x));
});
// Tabellenzeile des Vereins oder null
export function findeVerein(env, suche) {
  const d = env && env.daten;
  return (d && d.tabelle.find(r => passt(r.name, suche) || passt(r.kurz, suche))) || null;
}

const wtag = (iso, zone) => new Date(iso).toLocaleDateString('de-DE', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'numeric' });
const uhr = (iso, zone) => new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
const wkurz = (iso, zone) => new Date(iso).toLocaleDateString('de-DE', { timeZone: zone, weekday: 'short' });
const anstoss = (iso, zone) => (iso ? `${wtag(iso, zone)} ${uhr(iso, zone)}` : 'Termin offen');
const saisonText = j => `${j}/${String(j + 1).slice(2)}`;
const stand = s => (s.tore ? `${s.tore[0]}:${s.tore[1]}` : '–:–');

// Spiele des Vereins aus den (bis zu drei) Spieltagen, nach Anstoß; dazu Gegner, Heim/Auswärts und Ergebnis aus seiner Sicht
function eigeneSpiele(d, me) {
  const ist = v => v.id != null ? v.id === me.id : v.name === me.name;
  return d.spieltage.flatMap(t => t.spiele.filter(s => ist(s.heim) || ist(s.gast)).map(s => {
    const heim = ist(s.heim), gegner = heim ? s.gast : s.heim;
    const erg = s.beendet && s.tore ? (s.tore[0] === s.tore[1] ? 'U' : (s.tore[0] > s.tore[1]) === heim ? 'S' : 'N') : null;
    return { ...s, spieltag: t.name, heimspiel: heim, gegner, erg };
  })).sort((a, b) => String(a.beginn).localeCompare(String(b.beginn)));
}

// Die Kachel. env: Antwort des Dienstes (Liga mit dem Verein) oder null (Verein in keiner Liga gefunden)
export function kachel(env, suche, zone = 'Europe/Berlin') {
  const me = findeVerein(env, suche);
  if (!me) {
    return {
      state: 'off', title: 'Sport', m: 'Verein wählen', ms: '–', x: `„${suche}“ wurde in der 1. bis 3. Liga nicht gefunden.`, liste: [],
      kleinReiter: [{ id: 'verein', name: 'Verein', icon: icon(SYM.verein), kopf: '<b>Verein nicht gefunden</b>',
        html: `<p class="kl-leer">„${esc(suche)}“ spielt nicht in der 1., 2. oder 3. Bundesliga. Verein im Zahnrad anpassen.</p>` }],
      info: ['Ligen: 1., 2. und 3. Bundesliga der Männer (OpenLigaDB)']
    };
  }
  const d = env.daten, liga = d.liga.name, mine = eigeneSpiele(d, me);
  const zuletzt = mine.filter(s => s.beendet).pop() || null, naechstes = mine.find(s => !s.beendet) || null;
  const paarung = s => `${s.heim.kurz} ${stand(s)} ${s.gast.kurz}`;
  const gegen = s => `${s.gegner.kurz} (${s.heimspiel ? 'H' : 'A'})`;

  // Reiter „Verein“: zuletzt, nächstes Spiel (Gegner zuerst – bleibt auch in schmalen Kacheln sichtbar), Bilanz
  const verein = [
    ...(zuletzt ? [{ d: 'Zuletzt', t: `${stand(zuletzt)} gegen ${gegen(zuletzt)}`, tip: `${zuletzt.spieltag}, ${wtag(zuletzt.beginn, zone)}: ${zuletzt.heim.name} – ${zuletzt.gast.name} ${stand(zuletzt)} (${ERG[zuletzt.erg] || ''})`, gruppe: 1 }] : []),
    ...(naechstes ? [{ d: 'Nächstes', t: `${gegen(naechstes)} · ${anstoss(naechstes.beginn, zone)}`, tip: `${naechstes.spieltag}: ${naechstes.heim.name} – ${naechstes.gast.name}`, gruppe: 1 }] : []),
    { d: 'Punkte', t: `${me.punkte} aus ${me.spiele} Spielen`, tip: `${me.siege} Siege, ${me.unentschieden} Unentschieden, ${me.niederlagen} Niederlagen`, gruppe: 2 },
    { d: 'Bilanz', t: `${me.siege} S · ${me.unentschieden} U · ${me.niederlagen} N`, tip: `${me.siege} Siege, ${me.unentschieden} Unentschieden, ${me.niederlagen} Niederlagen`, gruppe: 2 },
    { d: 'Tore', t: `${me.tore}:${me.gegentore} (${me.differenz > 0 ? '+' : ''}${me.differenz})`, tip: `${me.tore} Tore, ${me.gegentore} Gegentore`, gruppe: 2 }
  ];
  // Reiter „Tabelle“: ab zwei Plätzen über dem eigenen Verein (was nicht passt, blendet die Kachel aus)
  const tabelle = d.tabelle.slice(Math.max(0, me.platz - 3)).map(r => ({ d: `${r.platz}.`, t: `${r.kurz} · ${r.punkte} Pkt${r.platz === me.platz ? ' ◀' : ''}`,
    tip: `${r.name}: ${r.punkte} Punkte, ${r.spiele} Spiele, Tore ${r.tore}:${r.gegentore}`, gruppe: r.platz === me.platz ? 2 : 1 }));
  // Reiter „Spieltag“: der Spieltag mit dem nächsten (sonst letzten) Spiel des Vereins; das eigene Spiel zuerst
  const tag = d.spieltage.find(t => t.nr === d.aktuell) || d.spieltage[d.spieltage.length - 1];
  const eigenes = s => s.heim.id === me.id || s.gast.id === me.id;
  const spieltag = tag ? [...tag.spiele.filter(eigenes), ...tag.spiele.filter(s => !eigenes(s))].map(s => ({
    d: s.beendet ? stand(s) : s.beginn ? `${wkurz(s.beginn, zone)} ${uhr(s.beginn, zone)}` : '–', t: `${s.heim.kurz} – ${s.gast.kurz}${eigenes(s) ? ' ◀' : ''}`,
    tip: `${s.heim.name} – ${s.gast.name}: ${s.beendet ? `Endstand ${stand(s)}` : `Anstoß ${anstoss(s.beginn, zone)}`}`, gruppe: eigenes(s) ? 1 : 2 })) : [];

  const x = [zuletzt ? `Zuletzt ${stand(zuletzt)} gegen ${zuletzt.gegner.kurz}` : null, naechstes ? `Nächstes: ${anstoss(naechstes.beginn, zone)} gegen ${naechstes.gegner.kurz}` : null]
    .filter(Boolean).join(' · ') || liga;
  return {
    state: 'live', title: me.kurz, m: `Platz ${me.platz}`, ms: `Platz ${me.platz}`, x, liste: [], startReiter: 'verein',
    kleinReiter: [
      { id: 'verein', name: 'Verein', icon: icon(SYM.verein), kopf: `<b>${esc(me.kurz)}</b> <small>Platz ${me.platz} · ${esc(liga)}</small>`, liste: verein },
      { id: 'tabelle', name: 'Tabelle', icon: icon(SYM.tabelle), kopf: `<b>Tabelle</b> <small>${esc(liga)} ${saisonText(d.saison)}</small>`, liste: tabelle,
        html: '<p class="kl-leer">Die Tabelle ist noch leer.</p>' },
      { id: 'spieltag', name: 'Spieltag', icon: icon(SYM.spieltag), kopf: `<b>${esc(tag ? tag.name : 'Spieltag')}</b> <small>${esc(liga)}</small>`, liste: spieltag,
        html: '<p class="kl-leer">Kein Spieltag angesetzt.</p>' }
    ],
    info: [`${liga} ${saisonText(d.saison)}`, 'Quelle: OpenLigaDB (Community-Datenbank)']
  };
}

// Antwort für „Frag DAILY“
export function antwort(env, suche, zone = 'Europe/Berlin') {
  const me = findeVerein(env, suche);
  if (!env) return 'Die Fußballdaten sind gerade nicht verfügbar.';
  if (!me) return `„${suche}“ habe ich in der 1. bis 3. Liga nicht gefunden – den Verein stellst du im Zahnrad der Kachel „Sport“ ein.`;
  const mine = eigeneSpiele(env.daten, me), z = mine.filter(s => s.beendet).pop(), n = mine.find(s => !s.beendet);
  return `${me.name}: Platz ${me.platz} in der ${env.daten.liga.name} mit ${me.punkte} Punkten.` +
    (z ? ` Zuletzt ${z.heim.kurz} – ${z.gast.kurz} ${stand(z)}.` : '') +
    (n ? ` Nächstes Spiel: ${anstoss(n.beginn, zone)}, ${n.heim.kurz} – ${n.gast.kurz}.` : '');
}
