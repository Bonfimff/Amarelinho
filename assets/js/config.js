// Configuração central. Para integrar com uma fonte oficial/autorizada,
// troque `dataProvider` para 'http' e informe `apiBaseUrl` (ver services/httpTransportProvider.js).
export const APP_CONFIG = {
  // 'api': API do Amarelinho em api-amarelinho.exksvol.com, com dados locais como reserva.
  // Em localhost usa os dados locais ('mock').
  dataProvider: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'mock' : 'api', // 'mock' | 'api' | 'http'
  apiBaseUrl: 'https://api-amarelinho.exksvol.com/api/v1',

  // Intervalo de atualização do "GPS" (tempo real, em ms). No modo http, é o intervalo de consulta a GET /vehicles.
  gpsRefreshMs: 5000,

  // Demonstração: TZ01 (Piabetá → Magé). A simulação começa na hora atual, em tempo real (1x).
  demo: {
    lineId: 'TZ01',
    directionId: 'ida',
    defaultSpeed: 1
  },

  speeds: [1, 2, 5, 10],

  map: {
    center: [-22.645, -43.11],
    zoom: 12,
    // Tiles padrão do OpenStreetMap (uso leve de demonstração, conforme a política de uso da OSMF).
    // Para produção, usar um provedor de tiles contratado ou servidor próprio.
    tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>'
  }
};
