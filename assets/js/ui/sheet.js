// Painel inferior arrastável (celular). No desktop vira painel lateral fixo.
// Apenas dois estados: full (cobre a tela) e collapsed (só a alça; o mapa ocupa tudo).
// Nada de alturas intermediárias dividindo a tela entre painel e mapa.
const SNAPS = { collapsed: 0, full: 1 };
const COLLAPSED_PX = 34;
const LABELS = { collapsed: 'recolhido', full: 'expandido' };
/** Qualquer pedido de altura parcial vira painel inteiro. */
const norm = (state) => (state === 'collapsed' ? 'collapsed' : 'full');

export class BottomSheet {
  #el;
  #handle;
  #state = 'full';
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
      if (e.key === 'ArrowUp') { e.preventDefault(); this.set('full'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.set('collapsed'); }
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
    return state === 'collapsed' ? COLLAPSED_PX : this.#fullHeight();
  }

  set(state, animate = true) {
    this.#state = norm(state);
    this.#apply(animate);
  }

  /** Toque na alça: recolhe por completo ou reabre por completo. */
  cycle() { this.set(this.#state === 'collapsed' ? 'full' : 'collapsed'); }

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
      // Solta no estado mais próximo: metade do caminho decide entre recolher e abrir tudo.
      this.set(visible > (h + COLLAPSED_PX) / 2 ? 'full' : 'collapsed');
      setTimeout(() => { this.#drag = null; }, 0);
      ev.preventDefault();
    };
    this.#handle.addEventListener('pointermove', move);
    this.#handle.addEventListener('pointerup', up);
    this.#handle.addEventListener('pointercancel', up);
  }
}
