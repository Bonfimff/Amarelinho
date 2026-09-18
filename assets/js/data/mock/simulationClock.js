import { Emitter } from '../../lib/emitter.js';

export class SimulationClock extends Emitter {
  #sec;
  #initialSec;
  #speed;
  #playing = false;
  #lastReal = 0;
  #timer = null;

  #defaultSpeed;
  #resetTo;

   
  constructor({ startSec, speed = 1, resetTo = null }) {
    super();
    this.#sec = startSec;
    this.#initialSec = startSec;
    this.#speed = speed;
    this.#defaultSpeed = speed;
    this.#resetTo = resetTo;
  }

  get now() {
    if (this.#playing) this.#advance();
    return this.#sec;
  }
  get speed() { return this.#speed; }
  get playing() { return this.#playing; }

  #advance() {
    const t = performance.now();
    this.#sec += ((t - this.#lastReal) / 1000) * this.#speed;
    this.#lastReal = t;
  }

  play() {
    if (this.#playing) return;
    this.#playing = true;
    this.#lastReal = performance.now();
    this.#timer = setInterval(() => this.emit('tick', this.now), 250);
    this.emit('state', this.snapshot());
  }

  pause() {
    if (!this.#playing) return;
    this.#advance();
    this.#playing = false;
    clearInterval(this.#timer);
    this.emit('state', this.snapshot());
  }

  setSpeed(speed) {
    if (this.#playing) this.#advance();
    this.#speed = speed;
    this.emit('state', this.snapshot());
  }

   
  reset() {
    if (this.#playing) this.#lastReal = performance.now();
    this.#sec = this.#resetTo ? this.#resetTo() : this.#initialSec;
    this.#speed = this.#defaultSpeed;
    this.emit('state', this.snapshot());
  }

  jumpTo(sec) {
    if (this.#playing) this.#lastReal = performance.now();
    this.#sec = sec;
    this.emit('state', this.snapshot());
  }

  snapshot() {
    return { now: this.now, speed: this.#speed, playing: this.#playing };
  }
}
