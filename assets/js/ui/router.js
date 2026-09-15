// Roteador por hash (#/linha/TZ01?dir=ida). Cada rota aponta para uma view com mount/unmount.
const ROUTES = [
  { pattern: /^\/?$/, view: 'home' },
  { pattern: /^\/linhas\/?$/, view: 'lines' },
  { pattern: /^\/ao-vivo\/?$/, view: 'live' },
  { pattern: /^\/linha\/([A-Z0-9]+)\/?$/i, view: 'line', keys: ['lineId'] },
  { pattern: /^\/linha\/([A-Z0-9]+)\/ponto\/([a-z0-9-]+)\/?$/i, view: 'stop', keys: ['lineId', 'stopId'] },
  { pattern: /^\/veiculo\/([A-Za-z0-9-]+)\/?$/, view: 'vehicle', keys: ['vehicleId'] },
  { pattern: /^\/buscar\/?$/, view: 'search' },
  { pattern: /^\/sobre\/?$/, view: 'about' }
];

export function parseLocation(hash = location.hash) {
  const clean = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = clean.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  for (const route of ROUTES) {
    const m = path.match(route.pattern);
    if (m) {
      const params = {};
      (route.keys || []).forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      if (params.lineId) params.lineId = params.lineId.toUpperCase();
      return { view: route.view, params, query, path };
    }
  }
  return { view: 'notFound', params: {}, query, path };
}

export function href(path, query) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString() : '';
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export const navigate = (path, query, { replace = false } = {}) => {
  const target = href(path, query);
  if (replace) history.replaceState(null, '', target); else location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
};
