// DAILY – alle Tests mit verstellter Uhr: über den Tag verteilt (alle 2 Stunden, je :15 – auch kurz nach Mitternacht deutscher Zeit)
// und über das Jahr (Winter, Frühjahr, Sommer, beide Zeitumstellungen und je 5 Tage davor). Findet Tests, die nur zu bestimmten Zeiten grün sind.
// Aufruf: npm run zeitreise   (läuft nicht bei Vercel; vor jedem Hochladen, Dauer etwa 1–2 Minuten)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const wurzel = path.join(__dirname, '..');
const tests = fs.readdirSync(path.join(wurzel, 'test')).filter(f => f.endsWith('.test.js')).map(f => path.join('test', f));
const uhr = pathToFileURL(path.join(__dirname, 'zeitreise-uhr.mjs')).href;

// Zeitpunkte: heute alle 2 Stunden; dazu die nächsten Termine 15.1., 15.4., 15.7. (12 Uhr UTC) und die Tage der Zeitumstellung
const jetzt = new Date(), tag = jetzt.toISOString().slice(0, 10), jahr = jetzt.getUTCFullYear();
const naechster = (m, t, h = 12) => { let d = new Date(Date.UTC(jahr, m - 1, t, h, 15)); if (d <= jetzt) d = new Date(Date.UTC(jahr + 1, m - 1, t, h, 15)); return d.toISOString(); };
const letzterSonntag = (j, m) => { const d = new Date(Date.UTC(j, m, 0)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d; };
const umstellung = m => { let d = letzterSonntag(jahr, m); if (d <= jetzt) d = letzterSonntag(jahr + 1, m); d.setUTCHours(10, 15); return d.toISOString(); };
const vorher = (iso, tage) => new Date(Date.parse(iso) - tage * 864e5).toISOString();
const PUNKTE = [
  ...Array.from({ length: 12 }, (_, i) => `${tag}T${String(i * 2).padStart(2, '0')}:15:00Z`),
  naechster(1, 15), naechster(4, 15), naechster(7, 15), umstellung(3), umstellung(10),
  vorher(umstellung(3), 5), vorher(umstellung(10), 5)   // Umstellung liegt in den Vorhersagetagen
];

function lauf(zeit) {
  return new Promise(fertig => {
    const p = spawn(process.execPath, ['--test', ...tests], {
      cwd: wurzel, env: { ...process.env, DAILY_UHR: zeit, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import ${uhr}`.trim() }
    });
    let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    p.on('close', code => {
      const rot = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1]);
      const pass = (out.match(/^# pass (\d+)/m) || [])[1];
      fertig({ zeit, ok: code === 0, pass, rot });
    });
  });
}

(async () => {
  const ergebnisse = [], offen = [...PUNKTE];
  const arbeiter = async () => { while (offen.length) ergebnisse.push(await lauf(offen.shift())); };
  await Promise.all([arbeiter(), arbeiter(), arbeiter()]);
  ergebnisse.sort((a, b) => a.zeit.localeCompare(b.zeit));
  for (const e of ergebnisse) console.log(`${e.ok ? 'ok ' : 'ROT'} ${e.zeit}  ${e.ok ? `${e.pass} Tests` : e.rot.join(' | ') || 'Abbruch'}`);
  const rot = ergebnisse.filter(e => !e.ok).length;
  console.log(rot ? `\n${rot} von ${ergebnisse.length} Zeitpunkten rot` : `\nAlle ${ergebnisse.length} Zeitpunkte grün`);
  process.exitCode = rot ? 1 : 0;
})();
