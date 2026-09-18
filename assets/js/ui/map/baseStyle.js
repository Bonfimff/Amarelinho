const C = {
  land: '#EFEBE7',
  water: '#A7CBE5',
  park: '#B6C73C',
  wood: '#CBD68A',
  minor: '#FFFFFF',
  major: '#F6C99B',
  motorway: '#F2B880',
  rail: '#D9D3CD',
  building: '#E6E1DC',
  label: '#6B6560',
  halo: '#EFEBE7',
  boundary: '#CFC8C1'
};

const ROAD_W = (base) => ['interpolate', ['exponential', 1.5], ['zoom'], 10, base * 0.35, 14, base, 18, base * 6];

export const BASE_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': C.land } },
    { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]], paint: { 'fill-color': C.wood, 'fill-opacity': 0.22 } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park, 'fill-opacity': 0.85 } },
    { id: 'landuse-green', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['cemetery', 'stadium', 'pitch', 'playground']]], paint: { 'fill-color': C.park, 'fill-opacity': 0.7 } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': C.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 3] } },
    { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 15, paint: { 'fill-color': C.building } },
    { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': C.rail, 'line-width': 1.5 } },
    { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary', 'track']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.minor, 'line-width': ROAD_W(2.2) } },
    { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.major, 'line-width': ROAD_W(4) } },
    { id: 'road-motorway', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.motorway, 'line-width': ROAD_W(5) } },
    { id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 8], paint: { 'line-color': C.boundary, 'line-dasharray': [3, 2], 'line-width': 1 } },
    { id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15,
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
      paint: { 'text-color': C.label, 'text-halo-color': C.minor, 'text-halo-width': 1.5 } },
    { id: 'place-label', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood']]],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-transform': 'uppercase', 'text-letter-spacing': 0.08,
        'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 13, 11] },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.6 } }
  ]
};
