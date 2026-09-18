import { Emitter } from '../lib/emitter.js';

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

  watch(lineId) {
    this.#lineIds = new Set([lineId]);
    this.#schedule();
    return this.refresh({ keepTimestamp: this.snapshot.receivedAt > 0 });
  }

  #schedule() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {

      if (this.#provider.clock && !this.#provider.clock.playing) { this.#schedule(); return; }
      this.refresh();
    }, this.#intervalMs);
  }

  async refresh({ keepTimestamp = false } = {}) {
    const ids = [...this.#lineIds];
    const seq = ++this.#seq;
    const lists = await Promise.all(ids.map((lineId) => this.#provider.getVehicles({ lineId })));

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
