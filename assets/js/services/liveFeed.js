// Atualização periódica dos veículos ("GPS"). Com dados reais, basta apontar o provedor para a API:
// o feed continua consultando GET /vehicles no mesmo intervalo.
import { Emitter } from '../lib/emitter.js';

export class LiveFeed extends Emitter {
  #provider;
  #intervalMs;
  #timer = null;
  #lineIds = new Set();
  snapshot = { vehicles: [], receivedAt: 0, clockSec: 0 };

  constructor(provider, intervalMs) {
    super();
    this.#provider = provider;
    this.#intervalMs = intervalMs;
    const clock = provider.clock;
    if (clock) clock.on('state', () => this.refresh());
  }

  get intervalMs() { return this.#intervalMs; }

  /** Passa a acompanhar apenas esta linha (cada tela mostra uma por vez). */
  watch(lineId) {
    this.#lineIds = new Set([lineId]);
    if (!this.#timer) {
      this.#timer = setInterval(() => {
        // Simulação pausada = nenhuma posição nova chega (o contador "Atualizado há…" continua correndo).
        if (this.#provider.clock && !this.#provider.clock.playing) return;
        this.refresh();
      }, this.#intervalMs);
    }
    return this.refresh({ keepTimestamp: this.snapshot.receivedAt > 0 });
  }

  async refresh({ keepTimestamp = false } = {}) {
    const ids = [...this.#lineIds];
    const lists = await Promise.all(ids.map((lineId) => this.#provider.getVehicles({ lineId })));
    const receivedAt = keepTimestamp ? this.snapshot.receivedAt : Date.now();
    this.snapshot = { vehicles: lists.flat(), receivedAt, clockSec: this.#provider.now() };
    this.emit('update', this.snapshot);
    return this.snapshot;
  }

  secondsSinceUpdate() {
    return this.snapshot.receivedAt ? Math.floor((Date.now() - this.snapshot.receivedAt) / 1000) : null;
  }
}
