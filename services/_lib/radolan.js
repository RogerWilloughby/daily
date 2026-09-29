// Radarraster des DWD (RADOLAN, Raster „DE1200“ auf WGS84, 1100 × 1200 Pixel à 1 km, wie Bright Sky es liefert) ↔ Koordinaten.
// Polare stereografische Projektion (Nordpol, wahrer Maßstab bei 60° N, Mittelmeridian 10° O), Parameter wie in der Doku von Bright Sky:
// +proj=stere +lat_0=90 +lat_ts=60 +lon_0=10 +a=6378137 +b=6356752.3142451802 +x_0=543196.83521776402 +y_0=3622588.8619310018
// Rasterkoordinaten: x nach Osten, y nach Süden, in Pixeln; die Mitte von Pixel (i, j) liegt bei (i, j), die Ecken des Rasters bei −0,5
// (geprüft an den Eckpunkten des DWD und an Positionen, die Bright Sky für Dresden und 54° N 8° O meldet – siehe test/dienste.test.js).
const A = 6378137, B = 6356752.3142451802, E = Math.sqrt(1 - (B * B) / (A * A));
const X0 = 543196.83521776402, Y0 = 3622588.8619310018, RAD = Math.PI / 180, LON0 = 10 * RAD, PHI_C = 60 * RAD;
const t = p => Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - E * Math.sin(p)) / (1 + E * Math.sin(p)), E / 2);
const MC = Math.cos(PHI_C) / Math.sqrt(1 - E * E * Math.sin(PHI_C) ** 2), TC = t(PHI_C), K = A * MC / TC;

// Breite/Länge (Grad) → Rasterkoordinaten (Pixel)
function zuRaster(lat, lon) {
  const r = K * t(lat * RAD), dl = lon * RAD - LON0;
  return { x: (X0 + r * Math.sin(dl)) / 1000, y: -(Y0 - r * Math.cos(dl)) / 1000 };
}

// Rasterkoordinaten (Pixel) → Breite/Länge (Grad)
function zuGrad(x, y) {
  const dx = x * 1000 - X0, dy = -y * 1000 - Y0, r = Math.hypot(dx, dy), tt = r / K;
  let phi = Math.PI / 2 - 2 * Math.atan(tt);
  for (let i = 0; i < 8; i++) phi = Math.PI / 2 - 2 * Math.atan(tt * Math.pow((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi)), E / 2));
  return { lat: phi / RAD, lon: (LON0 + Math.atan2(dx, -dy)) / RAD };
}

module.exports = { zuRaster, zuGrad };
