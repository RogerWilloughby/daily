// Einstellungen → „Privater Betrieb“ (Review M2, App 0.42.0): Kennwort für die privaten Dienste (Termine, Märkte, Schlagzeilen).
// Nur im privaten Betrieb sichtbar; das Kennwort bleibt in den Einstellungen dieses Browsers und geht nur an private Dienste.
import { settings, saveSettings } from '../core/store.js';

const NEU_LADEN = ['kalender', 'money', 'news'];   // Kacheln mit privaten Teilen

export function initPrivat(isPrivate) {
  const bereich = document.getElementById('set-privat');
  if (!bereich || !isPrivate) return;
  bereich.hidden = false;
  const feld = document.getElementById('set-kennwort'), meldung = document.getElementById('set-kennwort-meldung');
  const stand = () => { meldung.textContent = settings.kennwort ? 'Ein Kennwort ist gespeichert.' : 'Noch kein Kennwort gespeichert.'; };
  stand();
  const speichern = () => {
    const k = feld.value.trim();
    saveSettings({ kennwort: k || undefined });
    feld.value = '';
    meldung.textContent = k ? 'Gespeichert – die privaten Kacheln laden neu.' : 'Kennwort entfernt.';
    NEU_LADEN.forEach(id => document.dispatchEvent(new CustomEvent('daily:einstellungen', { detail: id })));
  };
  document.getElementById('set-kennwort-ok').addEventListener('click', speichern);
  feld.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); speichern(); } });
}
