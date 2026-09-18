export function createHttpTransportProvider({ baseUrl }) {
  const get = async (path, params) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null))}` : '';
    const res = await fetch(`${baseUrl}${path}${qs}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status} em ${path}`);
    return res.json();
  };

  return {
    kind: 'http',
    capabilities: { simulation: false },
    clock: null,
    demo: null,
    now: () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); },
    getLines: () => get('/lines'),
    getLine: (id) => get(`/lines/${encodeURIComponent(id)}`),
    getShape: (lineId, directionId) => get(`/lines/${encodeURIComponent(lineId)}/shape`, { directionId }),
    getStops: (lineId, directionId) => get('/stops', { lineId, directionId }),
    getVehicles: ({ lineId } = {}) => get('/vehicles', { lineId }),
    getVehicle: (id) => get(`/vehicle/${encodeURIComponent(id)}`),
    getArrivals: ({ lineId, directionId, stopId, limit }) => get('/arrivals', { lineId, directionId, stopId, limit })
  };
}
