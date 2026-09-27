// Adressen für „Meine Seiten“ prüfen (ohne DOM, damit testbar).
// Eingabe zu sicherer Adresse machen: nur http(s), „spiegel.de“ → „https://spiegel.de“
export function cleanUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try { const p = new URL(u); return /^https?:$/.test(p.protocol) && p.hostname.includes('.') ? p.href : null; } catch (e) { return null; }
}
