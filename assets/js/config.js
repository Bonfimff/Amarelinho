export const APP_CONFIG = {

  dataProvider: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'mock' : 'api',
  apiBaseUrl: 'https://api-amarelinho.exksvol.com/api/v1',

  analytics: {
    enabled: !/^(localhost|127\.0\.0\.1)$/.test(location.hostname),
    flushMs: 15000
  },

  gpsRefreshMs: 5000,

  demo: {
    lineId: 'TZ01',
    directionId: 'ida',
    defaultSpeed: 1
  },

  speeds: [1, 2, 5, 10],

  map: {
    center: [-22.645, -43.11],
    zoom: 12,

    tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>'
  }
};
