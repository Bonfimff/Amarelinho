// Peças compartilhadas pelas três telas do mototáxi (passageiro, mototaxista e Secretaria).
import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { simBadge } from '../components.js';
import { MotoWorld, RIDE_STATES, money } from '../../data/mock/mototaxi/world.js';
import { secToHHMM, secToHHMMSS } from '../../lib/time.js';
import { formatDistance } from '../../lib/geo.js';

export { money, RIDE_STATES, simBadge };
export { formatDistance };

let instance = null;
/** O mundo da simulação nasce na primeira visita à área e vive até a página ser fechada. */
export const world = () => (instance ||= new MotoWorld());

export const REG_LABEL = {
  nao_cadastrado: 'Sem cadastro', em_analise: 'Em análise', pendencia: 'Com pendência',
  aprovado: 'Aprovado', suspenso: 'Suspenso', cancelado: 'Cancelado'
};
export const DRIVER_STATUS = {
  ...REG_LABEL, disponivel: 'Disponível', offline: 'Offline', a_caminho: 'A caminho do passageiro', no_local: 'No local', em_corrida: 'Em corrida'
};
const REG_TONE = { aprovado: 'ok', em_analise: 'info', pendencia: 'warn', suspenso: 'bad', cancelado: 'muted', nao_cadastrado: 'muted' };
const RIDE_TONE = { ofertada: 'info', a_caminho: 'warn', no_local: 'warn', em_corrida: 'info', concluida: 'ok', cancelada: 'muted', sem_aceite: 'bad' };
const DOC_LABEL = { pendente: 'Não enviado', enviado: 'Enviado', aprovado: 'Aprovado', vencido: 'Vencido', recusado: 'Recusado' };
const DOC_TONE = { pendente: 'muted', enviado: 'info', aprovado: 'ok', vencido: 'bad', recusado: 'bad' };

export const pill = (text, tone = 'muted') => html`<span class="pill pill--${tone}">${text}</span>`;
export const regPill = (reg) => pill(REG_LABEL[reg] || reg, REG_TONE[reg]);
export const ridePill = (state) => pill(RIDE_STATES[state] || state, RIDE_TONE[state]);
export const docPill = (status) => pill(DOC_LABEL[status] || status, DOC_TONE[status]);

export const km = (m) => `${(m / 1000).toFixed(1).replace('.', ',')} km`;
export const minutes = (sec) => (sec < 45 ? 'menos de 1 min' : `${Math.max(1, Math.round(sec / 60))} min`);
export const stars = (n) => (n == null ? 'sem nota' : `${n.toFixed(1).replace('.', ',')} de 5`);
export const initial = (name) => (name?.trim()[0] || '?').toUpperCase();

/** "Para onde": origem x destino com o mesmo x azul dos cartões de linha. */
export const routeText = (ride) => html`${ride.origin.name} <span class="route-x" aria-hidden="true">x</span><span class="sr-only">para</span> ${ride.dest.name}`;

/** Cartão do profissional, como o passageiro vê: foto (inicial), nome, credencial, nota e moto. */
export function driverCard(w, d, extra = '') {
  const r = w.rating(d.id);
  return html`
    <div class="person">
      <span class="person__avatar" aria-hidden="true">${initial(d.name)}</span>
      <div class="person__body">
        <strong>${d.name}</strong>
        <span>${d.credential || 'Sem credencial'} · ${raw(icons.star('star-ico'))} ${stars(r)}</span>
        <span>${d.moto.model}, ${d.moto.color.toLowerCase()} · placa <b>${d.moto.plate}</b></span>
      </div>
      ${raw(extra)}
    </div>`;
}

export function timelineList(events) {
  return html`<ol class="events">${events.map((e) => html`<li><time>${secToHHMM(e.sim)}</time><span>${e.text}</span></li>`)}</ol>`;
}

/**
 * Agenda a redesenha da tela sem atropelar quem está digitando: se há um campo de texto com foco
 * dentro da tela, espera a pessoa sair dele. Ações da própria pessoa chamam render() direto.
 */
export function makeScheduler(el, render) {
  let queued = false;
  let deferred = false;
  const typing = () => {
    const a = document.activeElement;
    if (!a || !el.contains(a)) return false;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
    return a.tagName === 'INPUT' && /^(text|tel|number|search|email)$/.test(a.type);
  };
  const run = () => {
    queued = false;
    if (typing()) { deferred = true; return; }
    deferred = false;
    renderKeepingFocus(el, render);
  };
  const onBlur = () => { if (deferred) setTimeout(run, 0); };
  el.addEventListener('focusout', onBlur);
  return {
    schedule() { if (!queued) { queued = true; requestAnimationFrame(run); } },
    now() { renderKeepingFocus(el, render); },
    destroy() { el.removeEventListener('focusout', onBlur); }
  };
}

/** Redesenha e devolve o foco ao controle que o tinha (marcado com data-keep), para quem navega por teclado. */
export function renderKeepingFocus(el, render) {
  const keep = document.activeElement?.dataset?.keep;
  const top = el.parentElement?.scrollTop;
  el.classList.remove('is-entering'); // a animação de entrada é só da primeira abertura da tela
  render();
  if (keep) el.querySelector(`[data-keep="${keep}"]`)?.focus({ preventScroll: true });
  if (top != null && el.parentElement) el.parentElement.scrollTop = top;
}

/** Lembra quais <details data-key> estão abertos, para a tela redesenhada não fechá-los. */
export function openKeeper(el) {
  const open = new Set();
  const onToggle = (e) => {
    const k = e.target?.dataset?.key;
    if (!k) return;
    if (e.target.open) open.add(k); else open.delete(k);
  };
  el.addEventListener('toggle', onToggle, true);
  return { attr: (key) => (open.has(key) ? raw('open') : ''), add: (key) => open.add(key), destroy: () => el.removeEventListener('toggle', onToggle, true) };
}

/** Atualiza só o texto de elementos marcados com data-bind, sem redesenhar a tela. */
export function bindText(el, values) {
  for (const [key, text] of Object.entries(values)) {
    el.querySelectorAll(`[data-bind="${key}"]`).forEach((n) => { if (n.textContent !== text) n.textContent = text; });
  }
}

export const field = (label, control, hint = '') => html`<label class="field"><span class="field__label">${label}</span>${raw(control)}${hint ? raw(html`<span class="field__hint">${hint}</span>`) : ''}</label>`;

/**
 * Cartão flutuante sobre o mapa, igual ao da simulação dos ônibus: relógio, iniciar e pausar,
 * velocidade, pedidos simulados e uma linha de situação da tela atual.
 */
export class MotoFloat {
  #el;
  #off;

  constructor(host, w) {
    this.w = w;
    this.#el = document.createElement('section');
    this.#el.className = 'sim-float moto-float';
    this.#el.setAttribute('aria-label', 'Controles da simulação do mototáxi');
    this.#el.innerHTML = html`
      <div class="sim-float__head">
        <span class="sim-float__title">Simulação do mototáxi</span>
        <span class="sim-float__clock" title="Horário da simulação">${raw(icons.clock())}<strong data-clock>00:00:00</strong></span>
        <button type="button" class="sim-float__min" data-minimize aria-expanded="true" aria-label="Minimizar controles da simulação" title="Minimizar">${raw(icons.chevronDown())}</button>
      </div>
      <p class="moto-float__status" data-status aria-live="polite"></p>
      <div class="sim-float__body">
        <div class="sim-float__row">
          <button type="button" class="sim-float__btn sim-float__btn--play" data-toggle></button>
          <div class="sim-float__speed" role="radiogroup" aria-label="Velocidade da simulação">
            ${[1, 2, 5, 10].map((s) => html`<button type="button" role="radio" data-speed="${s}">${s}x</button>`)}
          </div>
        </div>
        <label class="sim-float__follow">
          <input type="checkbox" data-spawn /><span class="switch__track" aria-hidden="true"></span>Pedidos de outros passageiros (simulados)
        </label>
      </div>`;
    host.appendChild(this.#el);
    const q = (s) => this.#el.querySelector(s);
    q('[data-toggle]').addEventListener('click', () => (w.playing ? w.pause() : w.start()));
    this.#el.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => w.setSpeed(Number(b.dataset.speed))));
    q('[data-spawn]').addEventListener('change', (e) => w.setSpawn(e.target.checked));
    q('[data-minimize]').addEventListener('click', () => {
      const min = this.#el.classList.toggle('is-minimized');
      q('[data-minimize]').setAttribute('aria-expanded', String(!min));
    });
    const offs = [w.on('tick', () => this.#renderClock()), w.on('change', () => this.#render())];
    this.#off = () => offs.forEach((f) => f());
    this.#render();
  }

  setStatus(text) {
    const n = this.#el.querySelector('[data-status]');
    if (n.textContent !== text) n.textContent = text;
  }

  #renderClock() {
    const n = this.#el.querySelector('[data-clock]');
    const t = secToHHMMSS(this.w.sim);
    if (n.textContent !== t) n.textContent = t;
  }

  #render() {
    const w = this.w;
    this.#renderClock();
    const toggle = this.#el.querySelector('[data-toggle]');
    if (toggle.dataset.state !== String(w.playing)) {
      toggle.dataset.state = String(w.playing);
      toggle.innerHTML = w.playing ? `${icons.pause()}<span>Pausar</span>` : `${icons.play()}<span>Iniciar</span>`;
      toggle.setAttribute('aria-label', w.playing ? 'Pausar simulação' : 'Iniciar simulação');
    }
    this.#el.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.speed) === w.speed)));
    this.#el.querySelector('[data-spawn]').checked = w.spawnEnabled;
  }

  destroy() {
    this.#off();
    this.#el.remove();
  }
}
