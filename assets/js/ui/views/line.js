import { html, raw } from '../../lib/text.js';
import { icons, amarelinho } from '../icons.js';
import { href } from '../router.js';
import { lineChip, statusPill, simBadge, stopTimeline, itineraryList, scheduleBlock, sourceNotes, vehicleLocationText } from '../components.js';
import { formatEta, nowSec, upcomingDepartures, secToHHMM } from '../../lib/time.js';

const TABS = [
  { id: 'pontos', label: 'Pontos' },
  { id: 'horarios', label: 'Horários' },
  { id: 'itinerario', label: 'Itinerário' }
];

export default {
  sheet: 'full',
  title: 'Linha',

  async mount(el, ctx) {
    const { params, query, transport, liveFeed, map, getLine } = ctx;
    const line = getLine(params.lineId);
    if (!line) { el.innerHTML = html`<p class="empty">Linha não encontrada. <a href="${href('/linhas')}">Ver todas as linhas</a></p>`; return; }
    this.title = line.id;

    const dirId = line.directions[0]?.id || null;
    const tab = TABS.find((t) => t.id === query.aba)?.id || 'pontos';
    const stops = line.hasShape ? await transport.getStops(line.id, dirId) : [];
    const ret = line.returnLineId ? getLine(line.returnLineId) : null;

    el.innerHTML = html`
      <a class="back" href="${href('/linhas')}">${raw(icons.arrowLeft())}Linhas</a>
      <header class="line-head">
        ${raw(lineChip(line.id, 'line-chip--xl'))}
        <div class="line-head__body">
          <h1 class="line-head__title">${line.origin} <span class="line-head__x" aria-hidden="true">x</span><span class="sr-only">para</span> ${line.destination}</h1>
          <p class="line-head__meta">${line.variant ? `${line.variant} · ` : ''}${line.operatingHours.label}</p>
          <div class="line-head__badges">${raw(statusPill(line.operatingHours))}</div>
        </div>
      </header>

      ${ret ? raw(html`
        <a class="return-link" href="${href(`/linha/${ret.id}`, { aba: tab })}">
          ${raw(icons.swap())}<span>Volta: <b>${ret.id}</b> ${ret.origin} x ${ret.destination}</span>${raw(icons.chevronRight())}
        </a>`) : ''}

      ${line.hasLiveData ? raw(html`
        <section class="card live-summary" aria-labelledby="circ-title">
          <div class="card-head">
            <h2 id="circ-title" class="card-title">${raw(icons.bus())}Ônibus em circulação</h2>
            ${raw(simBadge())}
          </div>
          <div class="live-summary__grid">
            <div class="kpi"><span class="kpi__value" data-count>–</span><span class="kpi__label">na linha agora</span></div>
            <div class="kpi"><span class="kpi__value" data-next-eta>–</span><span class="kpi__label" data-next-label>próxima saída</span></div>
          </div>
          <ul class="vehicle-list" data-vehicles></ul>
          <p class="clock-line">${raw(icons.clock())}Horário da simulação: <strong data-clock>–</strong></p>
        </section>`) : raw(html`
        <div class="note" role="note">${raw(icons.info())}<p>${line.hasShape
          ? 'Os pontos desta linha estão no mapa. A localização dos ônibus ainda não está disponível para ela neste protótipo.'
          : 'A localização dos ônibus ainda não está disponível para esta linha neste protótipo. Veja abaixo os horários e o itinerário publicados.'}</p></div>
        ${line.schedule ? raw(this.nextDeparturesCard(line)) : ''}`)}

      <div class="tabs" role="tablist" aria-label="Informações da linha">
        ${TABS.map((t) => html`<a role="tab" class="tab" href="${href(`/linha/${line.id}`, { aba: t.id })}" aria-selected="${t.id === tab}">${t.label}</a>`)}
      </div>
      <div class="tab-panel" role="tabpanel">${raw(this.renderTab(tab, line, dirId, stops))}</div>
    `;

    if (!line.hasShape) { map.showOverview(); return; }

    const shape = await transport.getShape(line.id, dirId);
    map.showLine({ lineId: line.id, directionId: dirId, points: shape.points, stops });
    map.setFollow(null);
    if (!line.hasLiveData) return;

    const render = async (snap) => {
      const mine = snap.vehicles.filter((v) => v.lineId === line.id && v.status !== 'arrived');
      const count = el.querySelector('[data-count]');
      if (!count) return;
      count.textContent = String(mine.length);
      el.querySelector('[data-vehicles]').innerHTML = mine.length ? html`${mine.map((v) => html`
        <li><a class="vehicle-row" href="${href(`/veiculo/${v.id}`, { seguir: 1 })}">
          <span class="vehicle-row__icon">${raw(amarelinho())}</span>
          <span class="vehicle-row__text"><strong>Saída das ${v.scheduledDeparture}</strong><span>${vehicleLocationText(v)}</span></span>
          <span class="vehicle-row__eta">${v.nextStop ? html`<strong>${formatEta(v.nextStop.etaSec)}</strong><span>${v.nextStop.name}</span>` : ''}</span>
        </a></li>`)}` : html`<li class="empty">Nenhum ônibus em circulação neste momento.</li>`;
      const arr = await transport.getArrivals({ lineId: line.id, directionId: dirId, stopId: stops[0].id, limit: 1 });
      const nextEta = el.querySelector('[data-next-eta]');
      if (nextEta) nextEta.textContent = arr[0] ? formatEta(arr[0].etaSec) : '–';
      const label = el.querySelector('[data-next-label]');
      if (label) label.textContent = arr[0] ? `próxima saída de ${stops[0].name} (${arr[0].scheduledDeparture})` : 'sem saídas previstas';
      const clock = el.querySelector('[data-clock]');
      if (clock) clock.textContent = `${secToHHMM(snap.clockSec)}${transport.clock?.playing ? '' : ' (pausada)'}`;
      map.updateVehicles(snap.vehicles.filter((v) => v.lineId === line.id), { animateMs: liveFeed.intervalMs });
    };
    this.off = liveFeed.on('update', render);
    ctx.sim?.show();
    render(await liveFeed.watch(line.id));
  },

  nextDeparturesCard(line) {
    const at = nowSec();
    return html`<section class="card"><h2 class="card-title">Próximas saídas hoje</h2>
      ${line.schedule.directions.map((d) => {
        const next = upcomingDepartures(d.departures, at, 3);
        return html`<div class="next-deps"><span class="muted">${d.label}</span><div class="next-deps__row">${next.length ? next.map((s) => html`<span class="dep-pill"><strong>${secToHHMM(s)}</strong><small>em ${formatEta(s - at)}</small></span>`) : html`<span class="muted">Sem mais saídas hoje</span>`}</div></div>`;
      })}
      <p class="fine">Horários do quadro publicado pela Prefeitura.</p></section>`;
  },

  renderTab(tab, line, dirId, stops) {
    if (tab === 'horarios') {
      if (!line.schedule) return html`<p class="empty">Horários ainda não publicados pela Prefeitura.</p>${raw(sourceNotes(line))}`;
      return html`
        <p class="muted">${line.schedule.title}</p>
        ${line.schedule.directions.map((d) => scheduleBlock(d))}
        <p class="fine">A próxima saída é destacada com base no horário do seu aparelho.</p>
        ${line.schedule.pdf ? raw(html`<a class="btn btn--secondary" href="${line.schedule.pdf.url}" target="_blank" rel="noopener">${raw(icons.external())}Quadro de horários em PDF</a>`) : ''}
        ${raw(sourceNotes(line))}`;
    }
    if (tab === 'itinerario') {
      const p = line.published || {};
      return html`
        <dl class="facts">
          <div><dt>Linha</dt><dd>${line.origin} x ${line.destination}${line.variant ? ` (${line.variant})` : ''}</dd></div>
          <div><dt>Saída</dt><dd>${p.departure || 'Aguardando dados'}</dd></div>
          <div><dt>Chegada</dt><dd>${p.arrival || 'Aguardando dados'}</dd></div>
          <div><dt>Funcionamento</dt><dd>${line.operatingHours.label}</dd></div>
        </dl>
        ${line.hasShape ? raw(html`<p class="fine">O traçado no mapa e a posição de cada ponto são aproximados.</p>`) : ''}
        ${raw(sourceNotes(line))}
        <p class="fine">Fonte: <a href="https://mage.rj.gov.br/amarelinho/" target="_blank" rel="noopener">mage.rj.gov.br/amarelinho</a></p>`;
    }
    if (line.hasShape) {
      return html`<p class="muted">${line.published?.stopsLabel || 'Pontos de parada'} · ${stops.length} pontos</p>${raw(stopTimeline(stops, { lineId: line.id, directionId: dirId }))}${raw(sourceNotes(line))}`;
    }
    const p = line.published || {};
    return p.stops?.length
      ? html`<h3 class="list-title">${p.stopsLabel || 'Pontos publicados'}</h3>${raw(itineraryList(p.stops, { label: p.stopsLabel }))}${p.returnStops?.length ? raw(html`<h3 class="list-title">Itinerário publicado (volta)</h3>${raw(itineraryList(p.returnStops, { label: 'Itinerário publicado (volta)' }))}`) : ''}`
      : html`<p class="empty">Pontos de parada ainda não publicados pela Prefeitura.</p>`;
  },

  unmount() { this.off?.(); this.off = null; }
};

