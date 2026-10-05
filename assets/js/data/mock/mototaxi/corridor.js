import { TZ01_ROUTE } from '../../geo/tz01-route.js';
import { pointAtDistance, sliceRoute } from '../../../lib/geo.js';

export const CORRIDOR = { points: TZ01_ROUTE.points, totalM: TZ01_ROUTE.totalDistanceM };

export const PLACES = TZ01_ROUTE.stops.map((s) => ({ id: s.id, name: s.name, along: s.alongM, lat: s.lat, lng: s.lng }));

export const STAND_IDS = ['rodoviaria-piabeta', 'entrada-maua', 'entrada-principal-surui', 'entrada-mage-piedade', 'rodoviaria-mage'];

export const placeById = (id) => PLACES.find((p) => p.id === id);

export function latLngAt(along) {
  const p = pointAtDistance(CORRIDOR.points, Math.max(0, Math.min(CORRIDOR.totalM, along)));
  return { lat: p.lat, lng: p.lng, bearing: p.bearing };
}

export function pathBetween(a, b) {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const path = sliceRoute(CORRIDOR.points, from, to);
  return a <= b ? path : path.reverse();
}

export function nearestAlong(lat, lng) {
  const pts = CORRIDOR.points;
  const k = Math.cos((lat * Math.PI) / 180);
  let best = { d2: Infinity, along: 0 };
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = (a[1] - lng) * k;
    const ay = a[0] - lat;
    const dx = (b[1] - a[1]) * k;
    const dy = b[0] - a[0];
    const len2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d2 = px * px + py * py;
    if (d2 < best.d2) best = { d2, along: a[2] + (b[2] - a[2]) * t };
  }
  return { along: best.along, offM: Math.sqrt(best.d2) * 111320 };
}

export function nearestPlace(along) {
  return PLACES.reduce((best, p) => (Math.abs(p.along - along) < Math.abs(best.along - along) ? p : best), PLACES[0]);
}

export function placeAt(along) {
  const near = nearestPlace(along);
  if (Math.abs(near.along - along) < 120) return near;
  const { lat, lng } = latLngAt(along);
  return { id: `km-${Math.round(along)}`, name: `Perto de ${near.name}`, along, lat, lng };
}
