import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href } from '../router.js';
import { lineChip, arrivalsList, simBadge } from '../components.js';
import { secToHHMM } from '../../lib/time.js';

export default {
  title: 'Ponto',

  async mount(el, ctx) {
    const { params, transport, liveFeed, map, getLine, lines, announce } = ctx;
    const line = getLine(params.lineId);
    const dirId = line?.directions[0]?.id;
    const stops = line?.hasShape ? await transport.getStops(line.id, dirId) : [];
    const idx = stops.findIndex((s) => s.id === params.stopId);
    if (!line || idx < 0) { el.innerHTML = html`<p class="empty">Ponto não encontrado. <a href="${href('/linhas')}">Ver linhas</a></p>`; return; }
    const stop = stops[idx];
    this.title = stop.name;

    const others = [];
    for (const l of lines.filter((x) => x.hasShape && x.id !== line.id)) {
      const ls = await transport.getStops(l.id, l.directions[0].id);
      if (ls.some((s) => s.id === stop.id)) others.push(l);
    }

    el.innerHTML = html`
      <a class="back" href="${href(`/linha/${line.id}`, { aba: 'pontos' })}">${raw(icons.arrowLeft())}Linha ${line.id}</a>
      <header class="stop-head">
        <span class="stop-head__icon">${raw(icons.pin())}</span>
        <div>
          <p class="stop-head__eyebrow">Ponto ${stop.sequence} de ${stops.length}</p>
          <h1 class="stop-head__title">${stop.name}</h1>
          <p class="stop-head__dir">${raw(lineChip(line.id, 'line-chip--sm'))} sentido ${line.destination}</p>
        </div>
      </header>

      <section class="card" aria-labelledby="arr-title">
        <div class="card-head">
          <h2 id="arr-title" class="card-title">Próximos ônibus</h2>
          ${line.hasLiveData ? raw(simBadge('Previsão simulada')) : ''}
        </div>
        <div data-arrivals aria-live="polite">${line.hasLiveData
          ? raw('<div class="loading-row"><span class="spinner" aria-hidden="true"></span>Calculando previsões...</div>')
          : raw(html`<p class="empty">Previsão de chegada ainda não disponível para a ${line.id} neste protótipo.</p>`)}</div>
        ${line.hasLiveData ? raw(html`
          <p class="fine">Ônibus em circulação: posição e previsão simuladas. Saídas programadas: quadro de horários da Prefeitura mais o tempo médio de percurso.</p>
          <p class="clock-line">${raw(icons.clock())}Horário da simulação: <strong data-clock>–</strong></p>`) : ''}
      </section>

      <div class="stop-nav">
        ${idx > 0 ? raw(html`<a class="btn btn--secondary" href="${href(`/linha/${line.id}/ponto/${stops[idx - 1].id}`)}">${raw(icons.arrowLeft())}<span>${stops[idx - 1].name}</span></a>`) : raw('<span></span>')}
        ${idx < stops.length - 1 ? raw(html`<a class="btn btn--secondary stop-nav__next" href="${href(`/linha/${line.id}/ponto/${stops[idx + 1].id}`)}"><span>${stops[idx + 1].name}</span>${raw(icons.arrowRight())}</a>`) : raw('<span></span>')}
      </div>

      ${others.length ? raw(html`
        <section class="card">
          <h2 class="card-title">Outras linhas neste ponto</h2>
          <ul class="other-lines">${others.map((l) => html`<li><a href="${href(`/linha/${l.id}/ponto/${stop.id}`)}">${raw(lineChip(l.id, 'line-chip--sm'))}<span>${l.origin} x ${l.destination}</span>${raw(icons.chevronRight())}</a></li>`)}</ul>
        </section>`) : ''}

      <button class="btn btn--secondary btn--block" type="button" data-center>${raw(icons.target())}Ver ponto no mapa</button>
      <p class="fine">Nome do ponto conforme publicação da Prefeitura. Posição no mapa aproximada.</p>
    `;

    const shape = await transport.getShape(line.id, dirId);
    map.showLine({ lineId: line.id, directionId: dirId, points: shape.points, stops, fit: false });
    map.setFollow(null);
    map.highlightStop(stop.id, { pan: true });
    el.querySelector('[data-center]').addEventListener('click', () => map.highlightStop(stop.id, { pan: true }));
    if (!line.hasLiveData) return;

    let lastFirst = null;
    let running = [];
    const render = async (snap) => {
      running = snap.vehicles.filter((v) => v.lineId === line.id && v.status !== 'arrived');
      const arrivals = await transport.getArrivals({ lineId: line.id, directionId: dirId, stopId: stop.id, limit: 3 });
      const box = el.querySelector('[data-arrivals]');
      if (!box) return;
      box.innerHTML = arrivalsList(arrivals);
      const clock = el.querySelector('[data-clock]');
      if (clock) clock.textContent = `${secToHHMM(snap.clockSec)}${transport.clock?.playing ? '' : ' (pausada)'}`;
      const first = arrivals[0]?.tripId;
      if (first && lastFirst && first !== lastFirst) announce(`Próximo ônibus em ${box.querySelector('[data-eta]')?.textContent}`);
      lastFirst = first;
      map.updateVehicles(snap.vehicles.filter((v) => v.lineId === line.id), { animateMs: liveFeed.intervalMs });
    };
    this.off = liveFeed.on('update', render);
    bindFollowSwitch(ctx, () => running[0]?.id);
    render(await liveFeed.watch(line.id));
  },

  unmount() { this.off?.(); this.off = null; }
};
