// Bremse für Quellen mit eigenem Schlüssel (Architektur-Review H2, Entscheidung 02.10.2026): höchstens „max“ Abrufe je Zeitfenster
// und Funktionsinstanz (gleitendes Fenster). Schützt z. B. den Tankerkönig-Schlüssel vor Sperrung, wenn in kurzer Zeit sehr viele
// verschiedene Orte abgefragt werden. Darüber antwortet der Dienst mit quelle_fehler – die Oberfläche zeigt den letzten Stand.
function drossel(max, fensterMs = 60e3) {
  const zeiten = [];
  const darf = (jetzt = Date.now()) => {
    while (zeiten.length && zeiten[0] <= jetzt - fensterMs) zeiten.shift();
    if (zeiten.length >= max) return false;
    zeiten.push(jetzt);
    return true;
  };
  darf.zuruecksetzen = () => { zeiten.length = 0; };
  darf.max = max;
  return darf;
}

module.exports = { drossel };
