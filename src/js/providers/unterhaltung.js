// Kachel „Unterhaltung“: Rätsel, Witz, Film – mit Verlauf, Favoriten und „+ Aufgabe“ (providers/thema.js, Dienst „tagesinhalt“).
import { addAnswer } from '../core/ask.js';
import { themenAnbieter } from './thema.js';

const t = themenAnbieter('unterhaltung');
const i = () => (t.heute() ? t.heute().daten.inhalt : null);
addAnswer(/rätsel|raetsel|witz|lösung|loesung/i, q => { const x = i(); return x ? (/lösung|loesung/i.test(q) ? `Lösung: ${x.raetsel.loesung}` : `Rätsel: ${x.raetsel.frage} – Witz: ${x.witz}`) : null; });
addAnswer(/film|serie|fernsehen|abend/i, () => { const x = i(); return x && x.film ? `Filmtipp: ${x.film.titel} (${x.film.jahr}), ${x.film.genre}. ${x.film.text}` : null; });

export default t.provider;
