// Ansichten: Bereiche (bzw. ihre Anbieter) bringen eigene Darstellung mit, ohne dass die Oberfläche (core/oberflaeche.js) sie kennt.
// ansicht(id, def)   – nur für einen Bereich (id = Abschnitt tile-<id>): def.spalte(spalte, abschnitt) (Diagrammspalte überfahren),
//                      def.zurueck(abschnitt) (Diagramm verlassen)
// erweiterung(def)   – für alle: def.nachZeichnen(el), def.zeiger(event, blatt), def.groesse(blatt)
const KACHEL = {}, ALLE = [];
export const ansicht = (id, def) => { KACHEL[id] = def; };
export const ansichtVon = id => KACHEL[id] || null;
export const erweiterung = def => { ALLE.push(def); };
export const erweiterungen = () => ALLE;
