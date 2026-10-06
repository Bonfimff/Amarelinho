import { TZ01_ROUTE } from '../../geo/tz01-route.js';
import { haversine } from '../../../lib/geo.js';
import { roads, tilesAround } from './roads.js';

const NEIGHBORHOODS = [
  { id: 'bairro-maua', name: 'Mauá (centro do bairro)', lat: -22.713764, lng: -43.173423 },
  { id: 'bairro-santa-dalila', name: 'Santa Dalila (bairro)', lat: -22.658312, lng: -43.141812 },
  { id: 'bairro-barao-de-iriri', name: 'Barão de Iriri (bairro)', lat: -22.680991, lng: -43.100240 },
  { id: 'bairro-piedade', name: 'Piedade (bairro)', lat: -22.678943, lng: -43.065927 },
  { id: 'bairro-barbuda', name: 'Barbuda (bairro)', lat: -22.671696, lng: -43.032193 }
];

export const PLACES = [
  ...TZ01_ROUTE.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })),
  ...NEIGHBORHOODS
];

export const STAND_IDS = ['rodoviaria-piabeta', 'entrada-maua', 'entrada-principal-surui', 'entrada-mage-piedade', 'rodoviaria-mage'];

export const placeById = (id) => PLACES.find((p) => p.id === id);

export const SERVICE_TILES = tilesAround([
  ...TZ01_ROUTE.points.filter((_, i) => i % 6 === 0).map((p) => [p[0], p[1]]),
  ...NEIGHBORHOODS.map((p) => [p.lat, p.lng])
], 1300);

export const distanceM = (a, b) => haversine(a.lat, a.lng, b.lat, b.lng);

export function nearestPlace(lat, lng) {
  let best = PLACES[0];
  let bd = Infinity;
  for (const p of PLACES) {
    const d = haversine(lat, lng, p.lat, p.lng);
    if (d < bd) { bd = d; best = p; }
  }
  return { place: best, distM: bd };
}

export function placeAt(lat, lng) {
  const s = roads.snap(lat, lng, 1500);
  const p = s ? { lat: s.lat, lng: s.lng } : { lat, lng };
  const { place: near, distM } = nearestPlace(p.lat, p.lng);
  if (distM < 80) return near;
  return { id: `pt-${p.lat.toFixed(5)},${p.lng.toFixed(5)}`, name: `Rua perto de ${near.name}`, lat: p.lat, lng: p.lng };
}

export function snapToRoad(lat, lng) {
  const s = roads.snap(lat, lng, 2000);
  const p = s ? { lat: s.lat, lng: s.lng } : { lat, lng };
  const offM = s ? s.offM : 0;
  return {
    place: { id: 'gps', name: 'Sua localização', lat: p.lat, lng: p.lng, source: 'gps', offM },
    offM,
    onRoad: Boolean(s),
    near: nearestPlace(p.lat, p.lng).place
  };
}
