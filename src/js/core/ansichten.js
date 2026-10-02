// Kachel-Ansichten: Kacheln (bzw. ihre Anbieter) bringen eigene Darstellung mit, ohne dass das Raster (core/board.js) sie kennt.
// ansicht(id, def)   – nur für eine Kachel: def.teaser(t) → { html, klassen[] } (zusätzlicher Inhalt der Unterzeile),
//                      def.spalte(spalte, kachel) (Diagrammspalte überfahren), def.zurueck(kachel) (Diagramm verlassen)
// erweiterung(def)   – für alle Kacheln: def.nachZeichnen(el), def.zeiger(event, raster), def.groesse(raster)
const KACHEL = {}, ALLE = [];
export const ansicht = (id, def) => { KACHEL[id] = def; };
export const ansichtVon = id => KACHEL[id] || null;
export const erweiterung = def => { ALLE.push(def); };
export const erweiterungen = () => ALLE;
