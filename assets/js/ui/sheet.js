// Painel inferior arrastável (celular). No desktop vira painel lateral fixo.
// collapsed: só a alça fica visível; o mapa ocupa a tela toda.
const SNAPS = { collapsed: 0, peek: 0.36, half: 0.58, full: 1 };
const COLLAPSED_PX = 34;
const LABELS = { collapsed: 'recolhido', peek: 'baixo', half: 'meia altura', full: 'expandido' };

export class BottomSheet {
  #el;
  #handle;
  #state = 'half';
  #lastOpen = 'half';
  #mq = window.matchMedia('(min-width: 1024px)');
  #onChange;
  #drag = null;
  #locked = false;

  constructor(el, { onChange }) {
    this.#el = el;
    this.#handle = el.querySelector('[data-sheet-handle]');
    this.#onChange = onChange;
    this.#handle.addEventListener('pointerdown', (e) => { if (!this.#locked) this.#start(e); });
    this.#handle.addEventListener('click', () => { if (!this.#locked && !this.#drag?.moved) this.cycle(); });
    this.#handle.addEventListener('keydown', (e) => {
      if (this.#locked) return;
      const order = ['collapsed', 'peek', 'half', 'full'];
      const i = order.indexOf(this.#state);
      if (e.key === 'ArrowUp') { e.preventDefault(); this.set(order[Math.min(i + 1, 3)]); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.set(order[Math.max(i - 1, 0)]); }
    });
    window.addEventListener('resize', () => this.#apply(false));
    this.#mq.addEventListener('change', () => this.#apply(false));
  }

  get state() { return this.#state; }

  /** Trava o painel na altura atual (sem arrastar nem recolher). */
  setLocked(locked) {
    this.#locked = Boolean(locked);
    this.#el.toggleAttribute('data-locked', this.#locked);
    this.#handle.hidden = this.#locked;
  }

  #fullHeight() { return this.#el.getBoundingClientRect().height; }

  #visible(state) {
    const h = this.#fullHeight();
    if (state === 'collapsed') return COLLAPSED_PX;
    return state === 'full' ? h : Math.round(window.innerHeight * SNAPS[state]);
  }

  set(state, animate = true) {
    if (!(state in SNAPS)) return;
    this.#state = state;
    if (state !== 'collapsed') this.#lastOpen = state;
    this.#apply(animate);
  }

  /** Toque na alça: recolhe totalmente ou reabre na última altura usada. */
  cycle() { this.set(this.#state === 'collapsed' ? this.#lastOpen : 'collapsed'); }

  #apply(animate) {
    this.#el.dataset.state = this.#state;
    this.#handle.setAttribute('aria-label', this.#state === 'collapsed' ? 'Painel recolhido. Toque para abrir.' : `Painel de informações (${LABELS[this.#state]}). Toque para recolher.`);
    this.#handle.setAttribute('aria-expanded', String(this.#state !== 'collapsed'));
    if (this.#mq.matches) {
      this.#el.style.transform = '';
      this.#onChange?.(0);
      return;
    }
    const h = this.#fullHeight();
    const visible = Math.min(h, this.#visible(this.#state));
    this.#el.style.transition = animate ? '' : 'none';
    this.#el.style.transform = `translateY(${h - visible}px)`;
    this.#onChange?.(visible);
  }

  #start(e) {
    if (this.#mq.matches) return;
    const h = this.#fullHeight();
    const current = new DOMMatrixReadOnly(getComputedStyle(this.#el).transform).m42;
    this.#drag = { y0: e.clientY, t0: current, h, moved: false };
    this.#handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dy = ev.clientY - this.#drag.y0;
      if (Math.abs(dy) > 4) this.#drag.moved = true;
      const t = Math.max(0, Math.min(h - COLLAPSED_PX, this.#drag.t0 + dy));
      this.#el.style.transition = 'none';
      this.#el.style.transform = `translateY(${t}px)`;
    };
    const up = (ev) => {
      this.#handle.removeEventListener('pointermove', move);
      this.#handle.removeEventListener('pointerup', up);
      this.#handle.removeEventListener('pointercancel', up);
      if (!this.#drag.moved) return;
      const visible = h - new DOMMatrixReadOnly(getComputedStyle(this.#el).transform).m42;
      const nearest = Object.keys(SNAPS).reduce((best, s) => (Math.abs(this.#visible(s) - visible) < Math.abs(this.#visible(best) - visible) ? s : best), 'half');
      this.set(nearest);
      setTimeout(() => { this.#drag = null; }, 0);
      ev.preventDefault();
    };
    this.#handle.addEventListener('pointermove', move);
    this.#handle.addEventListener('pointerup', up);
    this.#handle.addEventListener('pointercancel', up);
  }
}
