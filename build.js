// Baut den Ordner public/: kopiert die App, holt die Schriften aus npm und erzeugt die App-Icons aus src/icon.svg.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, 'public');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });

// App-Dateien (HTML, CSS, JS-Module, Inhalte) 1:1 übernehmen; das Icon wird unten gerendert
fs.cpSync(path.join(__dirname, 'src'), OUT, { recursive: true, filter: src => !src.endsWith('icon.svg') });

// Version: Nummer aus package.json, Zeitpunkt und Commit (Vercel) in die App schreiben; Service-Worker-Cache je Upload neu
const { version } = require('./package.json');
const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;
const verDatei = path.join(OUT, 'js', 'core', 'version.js');
fs.writeFileSync(verDatei, fs.readFileSync(verDatei, 'utf8').replace(/export const APP = \{[^}]*\};/,
  `export const APP = ${JSON.stringify({ version, stand: new Date().toISOString(), commit })};`));
const swDatei = path.join(OUT, 'sw.js');
fs.writeFileSync(swDatei, fs.readFileSync(swDatei, 'utf8').replace(/const CACHE = '[^']*';/, `const CACHE = 'daily-${version}-${commit || Date.now()}';`));

const nm = p => require.resolve(p);
const fonts = {
  'bricolage-grotesque.woff2': '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  'figtree-400.woff2': '@fontsource/figtree/files/figtree-latin-400-normal.woff2',
  'figtree-500.woff2': '@fontsource/figtree/files/figtree-latin-500-normal.woff2',
  'figtree-600.woff2': '@fontsource/figtree/files/figtree-latin-600-normal.woff2'
};
for (const [name, mod] of Object.entries(fonts)) fs.copyFileSync(nm(mod), path.join(OUT, 'fonts', name));

const svg = fs.readFileSync(path.join(__dirname, 'src', 'icon.svg'));
// Maskable: Motiv verkleinert in die sichere Zone (80 %)
const maskSvg = Buffer.from(svg.toString()
  .replace('<g id="grid">', '<g id="grid" transform="translate(51.2 51.2) scale(0.8)">'));

(async () => {
  await sharp(svg).resize(192, 192).png().toFile(path.join(OUT, 'icons', 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(OUT, 'icons', 'icon-512.png'));
  await sharp(svg).resize(180, 180).png().toFile(path.join(OUT, 'icons', 'apple-touch-icon.png'));
  await sharp(maskSvg).resize(512, 512).png().toFile(path.join(OUT, 'icons', 'maskable-512.png'));
  console.log('DAILY gebaut: public/');
})().catch(e => { console.error(e); process.exit(1); });
