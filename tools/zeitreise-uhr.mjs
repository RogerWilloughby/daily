// Verstellt die Uhr für die Tests (tools/zeitreise.js): DAILY_UHR = ISO-Zeitpunkt, ab dem die Uhr weiterläuft.
// Wird per NODE_OPTIONS="--import …" in jeden Testprozess geladen; ohne DAILY_UHR ändert sich nichts.
const ziel = Date.parse(process.env.DAILY_UHR || '');
if (Number.isFinite(ziel)) {
  const Echt = globalThis.Date, versatz = ziel - Echt.now();
  class Date extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(Echt.now() + versatz); }
    static now() { return Echt.now() + versatz; }
  }
  globalThis.Date = Date;
}
