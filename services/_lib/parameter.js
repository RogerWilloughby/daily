// Erlaubte Angaben je Dienst (Entscheidung 02.10.2026, entscheidungen.md Abschnitt 14): Die Adresse ist der Cache-Schlüssel –
// sie enthält nur, wovon die Antwort abhängt, und das in genau einer Schreibweise. Alles andere wird abgelehnt (Fehler 400):
// unbekannte Angaben, Koordinaten mit mehr als 2 Nachkommastellen oder überflüssigen Nullen, Werte außerhalb der Auswahl.
// Jeder Dienst nennt seine Angaben im Feld „parameter“ (Name → Prüfung); „eingaben“ beschreibt sie für Katalog und Dienstblatt.
const { DienstFehler } = require('./rahmen');

// Zahl in der kurzen Schreibweise (wie JavaScript sie ausgibt: 51.05, 13.7, 9), höchstens 2 Nachkommastellen
const kurzeZahl = (v, max) => {
  const n = Number(v);
  return v !== '' && Number.isFinite(n) && String(n) === v && Math.round(n * 100) / 100 === n && Math.abs(n) <= max;
};

const P = {
  lat: { pruefe: v => kurzeZahl(v, 90), hilfe: 'Breitengrad mit höchstens 2 Nachkommastellen, ohne Nullen am Ende (z. B. 51.05)' },
  lon: { pruefe: v => kurzeZahl(v, 180), hilfe: 'Längengrad mit höchstens 2 Nachkommastellen, ohne Nullen am Ende (z. B. 13.7)' },
  datum: { pruefe: v => /^\d{4}-\d{2}-\d{2}$/.test(v), hilfe: 'Kalendertag JJJJ-MM-TT' },
  wahl: liste => ({ pruefe: v => liste.includes(v), hilfe: 'eins von: ' + liste.join(', ') }),
  text: (max, muster = null, beispiel = '') => ({ pruefe: v => v.trim() === v && v.length >= 1 && v.length <= max && (!muster || muster.test(v)),
    hilfe: `Text, höchstens ${max} Zeichen, ohne Leerzeichen am Rand${beispiel ? ` (z. B. ${beispiel})` : ''}` }),
  // nur im Körper einer POST-Anfrage (private Dienste); Inhalt prüft der Dienst selbst
  koerper: { pruefe: () => true, hilfe: '' }
};

// Eingabe prüfen → nur die erlaubten Angaben als Text (das ist dann auch der Schlüssel des Instanz-Zwischenspeichers).
// „_post“ setzt der Router für POST-Anfragen privater Dienste; deren Körper (z. B. eine Liste von Links) bleibt unverändert.
function pruefeEingaben(dienst, eingabe = {}) {
  const erlaubt = dienst.parameter || {}, post = !!eingabe._post, out = {};
  for (const [k, v] of Object.entries(eingabe)) {
    if (k === '_post' || v == null) continue;
    const p = erlaubt[k];
    if (!p) {
      const liste = Object.keys(erlaubt);
      throw new DienstFehler('eingabe_ungueltig', `Unbekannte Angabe „${k}“ – ${dienst.id} kennt ${liste.length ? liste.join(', ') : 'keine Angaben'}`);
    }
    if (post && p === P.koerper) { out[k] = v; continue; }
    const s = String(v);
    if (!p.pruefe(s)) throw new DienstFehler('eingabe_ungueltig', `Angabe „${k}“ ungültig: ${p.hilfe}`);
    out[k] = s;
  }
  if (post) out._post = true;
  return out;
}

module.exports = { P, pruefeEingaben, kurzeZahl };
