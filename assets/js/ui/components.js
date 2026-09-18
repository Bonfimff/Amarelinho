import { html, raw } from '../lib/text.js';
import { icons, amarelinho } from './icons.js';
import { href } from './router.js';
import { operationStatus, secToHHMM, hhmmToSec, formatEta, nowSec } from '../lib/time.js';
import { formatDistance } from '../lib/geo.js';

export const lineChip = (id, cls = '') => html`<span class="line-chip ${cls}" aria-label="Linha ${id}">${id}</span>`;

export const simBadge = (text = 'Simulação') => html`<span class="tag tag--sim" title="Informação simulada">${text}</span>`;
export const officialBadge = (text = 'Informação oficial') => html`<span class="tag tag--official" title="Publicado pela Prefeitura de Magé">${text}</span>`;

export function statusPill(hours, at = nowSec()) {
  const s = operationStatus(hours, at);
  return html`<span class="status ${s.open ? 'status--open' : 'status--closed'}"><span class="status__dot" aria-hidden="true"></span>${s.label}</span>`;
}

export function lineCard(line, { matched } = {}) {
  const s = operationStatus(line.operatingHours);
  const mapTag = line.hasLiveData ? 'Ônibus no mapa' : line.hasShape ? 'Pontos no mapa' : '';
  return html`
    <a class="line-card" href="${href(`/linha/${line.id}`)}" aria-label="Linha ${line.id}: ${line.origin} para ${line.destination}. ${s.label}.">
      <span class="line-card__chip">${raw(lineChip(line.id))}</span>
      <span class="line-card__body">
        <span class="line-card__route">${line.origin} <span class="line-card__x" aria-hidden="true">x</span> ${line.destination}</span>
        ${line.variant ? raw(html`<span class="line-card__variant">${line.variant}</span>`) : ''}
        <span class="line-card__meta">
          ${raw(statusPill(line.operatingHours))}
          <span class="line-card__hours">${line.operatingHours.label.replace('Diariamente, ', '')}</span>
          ${mapTag ? raw(html`<span class="line-card__map">${raw(icons.pin())}${mapTag}</span>`) : ''}
        </span>
        ${matched ? raw(html`<span class="line-card__match">${matched}</span>`) : ''}
      </span>
      <span class="line-card__chev">${raw(icons.chevronRight())}</span>
    </a>`;
}

export function skeletonCards(n = 4) {
  return Array.from({ length: n }, () => '<div class="line-card is-loading" aria-hidden="true"></div>').join('');
}

 
export function arrivalsList(arrivals, { emptyText = 'Nenhum ônibus previsto nas próximas horas.' } = {}) {
  if (!arrivals.length) return html`<p class="empty">${emptyText}</p>`;
  const ord = ['Próximo ônibus', 'Segundo', 'Terceiro', 'Quarto'];
  return html`<ol class="arrivals">${arrivals.map((a, i) => {
    const live = a.type === 'realtime';
    const body = html`
      <span class="arrivals__icon ${live ? 'is-live' : ''}">${raw(live ? amarelinho() : icons.bus())}</span>
      <span class="arrivals__text">
        <span class="arrivals__label">${ord[i] || `${i + 1}º`}</span>
        <span class="arrivals__sub">${live ? `Em circulação, saiu às ${a.scheduledDeparture}` : `Saída programada às ${a.scheduledDeparture}`}</span>
      </span>
      <span class="arrivals__eta">
        <strong class="eta" data-eta>${formatEta(a.etaSec)}</strong>
        <span class="arrivals__time">${a.arrivalTime} · ${live ? 'simulado' : 'quadro de horários'}</span>
      </span>`;
    return live
      ? html`<li><a class="arrivals__item is-live" href="${href(`/veiculo/${a.vehicleId}`)}" aria-label="${ord[i] || ''}: chega em ${formatEta(a.etaSec)}. Ônibus em circulação, posição simulada. Acompanhar.">${raw(body)}</a></li>`
      : html`<li><div class="arrivals__item">${raw(body)}</div></li>`;
  })}</ol>`;
}

export function stopTimeline(stops, { lineId, directionId, selectedId }) {
  return html`<ol class="timeline" aria-label="Pontos de parada da linha ${lineId}">${stops.map((s, i) => {
    const edge = i === 0 ? 'Saída' : i === stops.length - 1 ? 'Chegada' : '';
    return html`
    <li class="timeline__item ${edge ? 'is-edge' : ''} ${i === 0 ? 'is-first' : ''} ${i === stops.length - 1 ? 'is-last' : ''} ${s.id === selectedId ? 'is-selected' : ''}">
      <a class="timeline__link" href="${href(`/linha/${lineId}/ponto/${s.id}`, { dir: directionId })}">
        <span class="timeline__dot" aria-hidden="true">${edge ? raw(icons.bus()) : ''}</span>
        <span class="timeline__name">${edge ? raw(html`<b>${edge}:</b> `) : ''}${s.name}</span>
        <span class="timeline__chev">${raw(icons.chevronRight())}</span>
      </a>
    </li>`;
  })}</ol>`;
}

 
export function itineraryList(items, { label = 'Itinerário' } = {}) {
  return html`<ol class="timeline timeline--static" aria-label="${label}">${items.map((name, i) => {
    const edge = i === 0 ? 'Início' : i === items.length - 1 ? 'Fim' : '';
    return html`
    <li class="timeline__item ${edge ? 'is-edge' : ''} ${i === 0 ? 'is-first' : ''} ${i === items.length - 1 ? 'is-last' : ''}">
      <span class="timeline__link">
        <span class="timeline__dot" aria-hidden="true">${edge ? raw(icons.bus()) : ''}</span>
        <span class="timeline__name">${edge ? raw(html`<b>${edge}:</b> `) : ''}${name}</span>
      </span>
    </li>`;
  })}</ol>`;
}

export function scheduleBlock(direction, at = nowSec()) {
  const secs = direction.departures.map(hhmmToSec);
  const nextIdx = secs.findIndex((d) => d >= at);
  return html`
    <div class="schedule">
      <h4 class="schedule__title">${direction.label}</h4>
      <ul class="schedule__grid">
        ${direction.departures.map((t, i) => html`<li class="${i < nextIdx || nextIdx < 0 ? 'is-past' : ''} ${i === nextIdx ? 'is-next' : ''}">${t}${i === nextIdx ? raw('<span class="sr-only"> (próxima saída)</span>') : ''}</li>`)}
      </ul>
    </div>`;
}

export function sourceNotes(line) {
  if (!line.sourceNotes?.length) return '';
  return html`<div class="note note--warn" role="note">${raw(icons.info())}<div><strong>Sobre as informações publicadas</strong>${line.sourceNotes.map((n) => html`<p>${n}</p>`)}</div></div>`;
}

export function vehicleLocationText(v) {
  if (v.status === 'at_origin') return `Na ${v.origin}, aguardando partida`;
  if (v.status === 'arrived') return `Chegou à ${v.headsign}`;
  if (v.location.atStop) return `Parado em ${v.location.atStop.name}`;
  if (v.location.between) return `Entre ${v.location.between.from} e ${v.location.between.to}`;
  return 'Em circulação';
}

export const distanceText = (m) => formatDistance(m);
export const timeText = secToHHMM;

export function demoNotice() {
  return html`<div class="note" role="note">${raw(icons.info())}<p>Este protótipo utiliza informações públicas do Amarelinho e simula a localização dos veículos para demonstrar a experiência de acompanhamento em tempo real.</p></div>`;
}

export const sectionTitle = (text, id) => html`<h2 class="section-title"${id ? raw(` id="${id}"`) : ''}>${text}</h2>`;
