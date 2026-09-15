// Carrossel ("esteira") de comunicados com troca automática.
// Aceita cards de imagem ({ src, alt }) e cards com conteúdo próprio ({ html }).
// A imagem é exibida inteira (sem corte nem distorção); as laterais do card paisagem
// são preenchidas pela própria imagem ampliada e desfocada.
import { html, raw } from '../lib/text.js';
import { icons } from './icons.js';

const INTERVAL_MS = 5000;
const RESUME_AFTER_MS = 8000;

export class BannerCarousel {
  #root;
  #track;
  #dots;
  #items = [];
  #index = 0;
  #timer = null;
  #resumeTimer = null;
  #paused = false;
  #scrollRaf = 0;
  #reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  #onVisibility = () => (document.hidden ? this.#stop() : this.#start());

  constructor(root, items, { onEmpty } = {}) {
    this.#root = root;
    this.#items = items.slice();
    this.onEmpty = onEmpty;
    this.#render();
  }

  #render() {
    const n = this.#items.length;
    this.#root.className = 'banner';
    this.#root.setAttribute('aria-roledescription', 'carrossel');
    this.#root.setAttribute('aria-label', 'Comunicados da Prefeitura de Magé');
    this.#root.innerHTML = html`
      <div class="banner__viewport">
        <ul class="banner__track" aria-live="off">
          ${this.#items.map((b, i) => html`
            <li class="banner__slide" data-id="${b.id}" aria-roledescription="slide" aria-label="${i + 1} de ${n}: ${b.title}">
              ${b.html ? raw(html`<div class="banner__card banner__card--custom">${raw(b.html)}</div>`) : raw(html`
              <button type="button" class="banner__card" data-open="${b.id}" aria-label="Ampliar: ${b.title}">
                <span class="banner__bg" style="background-image:url('${b.src}')" aria-hidden="true"></span>
                <img class="banner__img" src="${b.src}" alt="${b.alt}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" />
              </button>`)}
            </li>`)}
        </ul>
        <button type="button" class="banner__nav banner__nav--prev" data-prev aria-label="Comunicado anterior">${raw(icons.arrowLeft())}</button>
        <button type="button" class="banner__nav banner__nav--next" data-next aria-label="Próximo comunicado">${raw(icons.arrowRight())}</button>
      </div>
      <div class="banner__dots" role="tablist" aria-label="Escolher comunicado"></div>
    `;
    this.#track = this.#root.querySelector('.banner__track');
    this.#dots = this.#root.querySelector('.banner__dots');

    // Remove cards cujo arquivo de imagem não existe.
    this.#root.querySelectorAll('.banner__img').forEach((img) => {
      img.addEventListener('error', () => this.#removeItem(img.closest('.banner__slide').dataset.id), { once: true });
    });

    this.#root.querySelector('[data-prev]').addEventListener('click', () => { this.#userAction(); this.goTo(this.#index - 1); });
    this.#root.querySelector('[data-next]').addEventListener('click', () => { this.#userAction(); this.goTo(this.#index + 1); });
    this.#track.addEventListener('scroll', () => {
      cancelAnimationFrame(this.#scrollRaf);
      this.#scrollRaf = requestAnimationFrame(() => this.#syncFromScroll());
    }, { passive: true });
    this.#track.addEventListener('pointerdown', () => this.#userAction());
    this.#track.addEventListener('wheel', () => this.#userAction(), { passive: true });
    this.#root.addEventListener('mouseenter', () => { this.#paused = true; });
    this.#root.addEventListener('mouseleave', () => { this.#paused = false; });
    this.#root.addEventListener('focusin', () => { this.#paused = true; });
    this.#root.addEventListener('focusout', () => { this.#paused = false; });
    this.#root.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return; // não atrapalhar a digitação na busca
      if (e.key === 'ArrowRight') { e.preventDefault(); this.#userAction(); this.goTo(this.#index + 1, { focus: true }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.#userAction(); this.goTo(this.#index - 1, { focus: true }); }
    });
    this.#root.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) this.#openLightbox(this.#items.find((b) => b.id === open.dataset.open));
    });
    document.addEventListener('visibilitychange', this.#onVisibility);

    this.#renderDots();
    this.#start();
  }

  #renderDots() {
    const n = this.#items.length;
    this.#root.classList.toggle('is-single', n <= 1);
    this.#dots.innerHTML = html`${this.#items.map((b, i) => html`<button type="button" role="tab" class="banner__dot" data-dot="${i}" aria-label="${b.title}" aria-selected="${i === this.#index}"></button>`)}`;
    this.#dots.querySelectorAll('[data-dot]').forEach((d) => d.addEventListener('click', () => { this.#userAction(); this.goTo(Number(d.dataset.dot)); }));
  }

  #removeItem(id) {
    this.#items = this.#items.filter((b) => b.id !== id);
    this.#root.querySelector(`.banner__slide[data-id="${id}"]`)?.remove();
    if (!this.#items.length) { this.destroy(); this.onEmpty?.(); return; }
    this.#index = Math.min(this.#index, this.#items.length - 1);
    this.#renderDots();
  }

  goTo(i, { focus = false } = {}) {
    const n = this.#items.length;
    if (!n) return;
    this.#index = (i + n) % n;
    const slide = this.#track.children[this.#index];
    this.#track.scrollTo({ left: slide.offsetLeft - this.#track.offsetLeft, behavior: this.#reduced ? 'auto' : 'smooth' });
    this.#updateDots();
    if (focus) slide.querySelector('.banner__card')?.focus({ preventScroll: true });
  }

  #syncFromScroll() {
    const w = this.#track.clientWidth || 1;
    const i = Math.round(this.#track.scrollLeft / w);
    if (i !== this.#index && i >= 0 && i < this.#items.length) { this.#index = i; this.#updateDots(); }
  }

  #updateDots() {
    this.#dots.querySelectorAll('[data-dot]').forEach((d, i) => d.setAttribute('aria-selected', String(i === this.#index)));
  }

  #start() {
    if (this.#reduced || this.#items.length <= 1) return;
    clearInterval(this.#timer);
    this.#timer = setInterval(() => { if (!this.#paused) this.goTo(this.#index + 1); }, INTERVAL_MS);
  }

  #stop() { clearInterval(this.#timer); this.#timer = null; }

  /** Interação manual pausa a troca automática por alguns segundos. */
  #userAction() {
    this.#stop();
    clearTimeout(this.#resumeTimer);
    this.#resumeTimer = setTimeout(() => this.#start(), RESUME_AFTER_MS);
  }

  #openLightbox(item) {
    if (!item) return;
    this.#stop();
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', item.title);
    dialog.innerHTML = html`
      <div class="lightbox__bar">
        <span class="lightbox__title">${item.title}<small>${item.credit}</small></span>
        <button type="button" class="lightbox__close" data-close aria-label="Fechar">${raw(icons.close())}</button>
      </div>
      <img class="lightbox__img" src="${item.src}" alt="${item.alt}" />`;
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); this.#start(); };
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dialog.showModal();
  }

  destroy() {
    this.#stop();
    clearTimeout(this.#resumeTimer);
    document.removeEventListener('visibilitychange', this.#onVisibility);
  }
}
