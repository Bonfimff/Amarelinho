import { html, raw } from '../lib/text.js';
import { icons } from './icons.js';
import { secToHHMMSS } from '../lib/time.js';
import { APP_CONFIG } from '../config.js';

export class SimControls {
  #el;
  #clock;
  #timer = null;
  #opts = {};
  #minimized = false;

  constructor(host, clock) {
    this.#clock = clock;
    this.#el = document.createElement('section');
    this.#el.className = 'sim-float';
    this.#el.setAttribute('aria-label', 'Controles da simulação');
    this.#el.hidden = true;
    this.#el.innerHTML = html`
      <div class="sim-float__head">
        <span class="sim-float__title">Simulação</span>
        <span class="sim-float__clock" title="Horário da simulação">${raw(icons.clock())}<strong data-clock>–</strong></span>
        <button type="button" class="sim-float__min" data-minimize aria-expanded="true" aria-controls="sim-float-body" aria-label="Minimizar controles da simulação" title="Minimizar">${raw(icons.chevronDown())}</button>
      </div>
      <div class="sim-float__body" id="sim-float-body">
      <div class="sim-float__row">
        <button type="button" class="sim-float__btn sim-float__btn--play" data-toggle></button>
        <button type="button" class="sim-float__btn" data-restart aria-label="Reiniciar viagem" title="Reiniciar viagem">${raw(icons.restart())}</button>
        <div class="sim-float__speed" role="radiogroup" aria-label="Velocidade da simulação">
          ${APP_CONFIG.speeds.map((s) => html`<button type="button" role="radio" data-speed="${s}">${s}x</button>`)}
        </div>
      </div>
      <label class="sim-float__follow" data-follow-wrap hidden>
        <input type="checkbox" data-follow /><span class="switch__track" aria-hidden="true"></span>Seguir o ônibus
      </label>
      </div>
    `;
    host.appendChild(this.#el);

    this.#el.querySelector('[data-toggle]').addEventListener('click', () => {
      if (clock.playing) { clock.pause(); return; }
      clock.play();
      this.setMinimized(true);
    });
    this.#el.querySelector('[data-restart]').addEventListener('click', () => { if (this.#opts.onRestart) this.#opts.onRestart(); else clock.reset(); });
    this.#el.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => clock.setSpeed(Number(b.dataset.speed))));
    this.#el.querySelector('[data-follow]').addEventListener('change', (e) => {

      if (this.#opts.onFollowChange) this.#opts.onFollowChange(e.target.checked);
      else e.target.checked = false;
    });
    this.#el.querySelector('[data-minimize]').addEventListener('click', () => this.setMinimized(!this.#minimized));
    clock.on('state', () => this.#render());
  }

  show(opts = {}) {
    if (!this.#clock) return;
    this.#opts = opts;
    const followWrap = this.#el.querySelector('[data-follow-wrap]');

    followWrap.hidden = false;
    this.setFollow(Boolean(opts.follow));
    this.#el.hidden = false;
    this.#render();
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.#render(), 500);
  }

  hide() {
    this.#el.hidden = true;
    this.#opts = {};
    clearInterval(this.#timer);
  }

  setMinimized(value) {
    this.#minimized = Boolean(value);
    this.#el.classList.toggle('is-minimized', this.#minimized);
    const btn = this.#el.querySelector('[data-minimize]');
    btn.setAttribute('aria-expanded', String(!this.#minimized));
    btn.setAttribute('aria-label', this.#minimized ? 'Expandir controles da simulação' : 'Minimizar controles da simulação');
    btn.title = this.#minimized ? 'Expandir' : 'Minimizar';
  }

  setFollow(checked) {
    this.#el.querySelector('[data-follow]').checked = Boolean(checked);
  }

  #render() {
    if (this.#el.hidden) return;
    const c = this.#clock;
    this.#el.querySelector('[data-clock]').textContent = secToHHMMSS(c.now);
    const toggle = this.#el.querySelector('[data-toggle]');
    if (toggle.dataset.state !== String(c.playing)) {
      toggle.dataset.state = String(c.playing);
      toggle.innerHTML = c.playing ? `${icons.pause()}<span>Pausar</span>` : `${icons.play()}<span>Iniciar</span>`;
      toggle.setAttribute('aria-label', c.playing ? 'Pausar simulação' : 'Iniciar simulação');
    }
    this.#el.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.speed) === c.speed)));
  }
}
