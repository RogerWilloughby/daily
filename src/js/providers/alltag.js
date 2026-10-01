// Kachel „Alltag“: Rezept, Gesundheit, Tech, Beziehung – mit Verlauf, Favoriten (auch die Spartipps aus „Finanzen“) und „+ Aufgabe“
// (providers/thema.js, Dienst „tagesinhalt“). Ersetzt seit 0.36.0 die Kacheln „Essen“, „Gesundheit“, „Tech“ und „Beziehung“.
import { addAnswer } from '../core/ask.js';
import { themenAnbieter } from './thema.js';

const t = themenAnbieter('alltag');
const i = () => (t.heute() ? t.heute().daten.inhalt : null);
addAnswer(/rezept|koch|essen|abendbrot|mittag/i, () => { const r = (i() || {}).rezept; return r ? `Heute: ${r.name} (${r.minuten} Minuten${r.vegetarisch ? ', vegetarisch' : ''}). Zutaten: ${r.zutaten.join(', ')}.` : null; });
addAnswer(/beziehung|partner|date|paar/i, () => { const b = (i() || {}).beziehung; return b ? `Idee für heute: ${b.text}` : null; });
addAnswer(/gesund|fitness|bewegung|sport treiben/i, () => { const g = (i() || {}).gesundheit; return g ? `Für heute: ${g.text}` : null; });
addAnswer(/tech.?tipp|computer|handy.?tipp|tastenkürzel|tastenkuerzel/i, () => { const x = (i() || {}).tech; return x ? `Tech-Tipp${x.kategorie ? ` (${x.kategorie})` : ''}: ${x.text}` : null; });

export default t.provider;
