// Atualização periódica dos veículos ("GPS"). Com dados reais, basta apontar o provedor para a API:
// o feed continua consultando GET /vehicles no mesmo intervalo.
import { Emitter } from '../lib/emitter.js';

// Ao iniciar a simulação, o primeiro snapshot é do mesmo instante do anterior: o veículo não teria
// para onde andar e ficaria parado até a atualização seguinte. Um segundo pedido logo depois já traz
// deslocamento, e o movimento começa quase junto com o toque.
const KICK_MS = 600;

export class LiveFeed extends Emitter {
  #provider;
  #intervalMs;
  #timer = null;
  #kick = null;
  #seq = 0;
  #lineIds = new Set();
  snapshot = { vehicles: [], receivedAt: 0, clockSec: 0 };

  constructor(provider, intervalMs) {
    super();
    this.#provider = provider;
    this.#intervalMs = intervalMs;
    const clock = provider.clock;
    if (clock) {
      clock.on('state', () => {
        this.refresh();
        clearTimeout(this.#kick);
        if (clock.playing) this.#kick = setTimeout(() => this.refresh(), KICK_MS);
      });
    }
  }

  get intervalMs() { return this.#intervalMs; }

  /** Passa a acompanhar apenas esta linha (cada tela mostra uma por vez). */
  watch(lineId) {
    this.#lineIds = new Set([lineId]);
    this.#schedule();
    return this.refresh({ keepTimestamp: this.snapshot.receivedAt > 0 });
  }

  /**
   * Agenda a próxima consulta. Reagendar a cada snapshot mantém o espaçamento regular mesmo depois
   * de uma consulta fora de hora — é esse espaçamento que a animação usa para cobrir o trecho.
   */
  #schedule() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      // Simulação pausada: nenhuma posição nova chega, mas a espera continua.
      if (this.#provider.clock && !this.#provider.clock.playing) { this.#schedule(); return; }
      this.refresh();
    }, this.#intervalMs);
  }

  async refresh({ keepTimestamp = false } = {}) {
    const ids = [...this.#lineIds];
    const seq = ++this.#seq;
    const lists = await Promise.all(ids.map((lineId) => this.#provider.getVehicles({ lineId })));
    // Com a API remota, uma resposta lenta pode chegar depois de outra mais recente: vale a mais nova.
    if (seq !== this.#seq) return this.snapshot;
    this.#schedule();
    const receivedAt = keepTimestamp ? this.snapshot.receivedAt : Date.now();
    this.snapshot = { vehicles: lists.flat(), receivedAt, clockSec: this.#provider.now() };
    this.emit('update', this.snapshot);
    return this.snapshot;
  }

  secondsSinceUpdate() {
    return this.snapshot.receivedAt ? Math.floor((Date.now() - this.snapshot.receivedAt) / 1000) : null;
  }
}
