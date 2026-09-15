// Ponto único de acesso a dados para a interface.
// A UI importa apenas `transport` e `liveFeed`; nunca importa o mock diretamente.
import { APP_CONFIG } from '../config.js';
import { createMockTransportProvider } from '../data/mock/mockTransportData.js';
import { createHttpTransportProvider } from './httpTransportProvider.js';
import { createApiTransportProvider } from './apiTransportProvider.js';
import { LiveFeed } from './liveFeed.js';

function createProvider() {
  if (APP_CONFIG.dataProvider === 'api') return createApiTransportProvider({ baseUrl: APP_CONFIG.apiBaseUrl, demo: APP_CONFIG.demo, speed: APP_CONFIG.demo.defaultSpeed });
  if (APP_CONFIG.dataProvider === 'http') return createHttpTransportProvider({ baseUrl: APP_CONFIG.apiBaseUrl });
  return createMockTransportProvider({ demo: APP_CONFIG.demo, speed: APP_CONFIG.demo.defaultSpeed });
}

export const transport = createProvider();
export const liveFeed = new LiveFeed(transport, APP_CONFIG.gpsRefreshMs);
