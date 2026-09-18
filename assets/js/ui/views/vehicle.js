import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href, navigate } from '../router.js';
import { lineChip, simBadge, vehicleLocationText } from '../components.js';
import { formatEta, hhmmToSec } from '../../lib/time.js';
import { formatDistance } from '../../lib/geo.js';

const STATUS = {
  in_transit: { label: 'Em circulação', cls: 'status--open' },
  at_stop: { label: 'Parado no ponto', cls: 'status--open' },
  at_origin: { label: 'Aguardando partida', cls: 'status--wait' },
  arrived: { label: 'Viagem concluída', cls: 'status--closed' },
  scheduled: { label: 'Ainda não partiu', cls: 'status--closed' }
};

export default {

  sheet: 'collapsed',
  title: 'Ônibus',

  async mount(el, ctx) {
    const { params, query, transport, liveFeed, map, getLine, announce, sim } = ctx;
    const clock = transport.clock;
    let vehicle = await transport.getVehicle(params.vehicleId);
    const line = vehicle && getLine(vehicle.lineId);
    if (!vehicle || !line) {
      el.innerHTML = html`<p class="empty">Ônibus não encontrado. <a href="${href('/ao-vivo')}">Ver ônibus ao vivo</a></p>`;
      return;
    }
    this.title = `${vehicle.lineId} · saída ${vehicle.scheduledDeparture}`;
    const dir = line.directions.find((d) => d.id === vehicle.directionId);

    el.innerHTML = html`
      <a class="back" href="${href(`/linha/${line.id}`)}">${raw(icons.arrowLeft())}Linha ${line.id}</a>
      <header class="veh-head">
        <span class="veh-head__bus"><img src="IMG/img-onibus.png" alt="" width="54" height="54" /></span>
        <div class="veh-head__body">
          <p class="veh-head__eyebrow">Amarelinho ${raw(lineChip(line.id, 'line-chip--sm'))} <span data-label>saída das ${vehicle.scheduledDeparture}</span></p>
          <h1 class="veh-head__title">${dir.from} <span class="line-head__x" aria-hidden="true">x</span><span class="sr-only">para</span> ${dir.to}</h1>
          <div class="veh-head__badges"><span class="status" data-status><span class="status__dot" aria-hidden="true"></span><span data-status-text>–</span></span>${raw(simBadge('Localização simulada'))}</div>
        </div>
      </header>

      <section class="card veh-main" aria-label="Situação do ônibus">
        <div class="veh-next">
          <div class="veh-next__place">
            <span class="stat__label">Próximo ponto</span>
            <strong class="veh-next__name" data-next>–</strong>
          </div>
          <div class="veh-next__eta">
            <span class="stat__label">Chegada estimada</span>
            <strong class="veh-next__time eta" data-eta>–</strong>
          </div>
        </div>
        <div class="veh-grid">
          <div><span class="stat__label">Distância</span><strong data-dist>–</strong></div>
          <div><span class="stat__label">Chegada ao destino</span><strong data-dest>–</strong></div>
        </div>
        <p class="veh-loc">${raw(icons.pin())}<span><span class="stat__label">Localização atual</span><span data-loc>–</span></span></p>
        <div class="progress" role="progressbar" aria-label="Progresso da viagem" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-progress>
          <span class="progress__bar" data-bar></span>
        </div>
        <div class="progress__legend"><span>${dir.from}</span><span data-pct>0%</span><span>${dir.to}</span></div>
        <p class="gps-line"><strong>Tempo real</strong><span>·</span><span class="gps-line__sim">localização simulada</span>
          <button type="button" class="link-map" data-see-map>${raw(icons.target())}Ver no mapa</button></p>
        <div class="veh-finished" data-finished hidden></div>
      </section>

      <section class="card" aria-labelledby="up-title">
        <h2 id="up-title" class="card-title">${raw(icons.route())}Pontos da viagem</h2>
        <ol class="upcoming" data-upcoming></ol>
        <a class="link-more" href="${href(`/linha/${line.id}`, { dir: dir.id, aba: 'pontos' })}">Ver itinerário completo ${raw(icons.chevronRight())}</a>
      </section>
    `;

    const $ = (sel) => el.querySelector(sel);
    const shape = await transport.getShape(line.id, dir.id);
    const stops = await transport.getStops(line.id, dir.id);
    map.showLine({ lineId: line.id, directionId: dir.id, points: shape.points, stops, fit: false });
    map.clearStopHighlight();
    map.setProgressVehicle(params.vehicleId);

    const follow = query.seguir !== '0';
    this.userUnfollowed = false;

    let introDone = false;
    map.fitRoute(shape.points, { onlyRoute: true });
    clock?.setSpeed(10);
    clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => {
      introDone = true;
      if (el.isConnected) liveFeed.refresh();
    }, 3000);
    let lastNextId = null;

    const renderVehicle = (v) => {
      vehicle = v;
      const statusKey = v.inService ? v.status : (clock && clock.now < hhmmToSec(v.scheduledDeparture) ? 'scheduled' : 'arrived');
      const st = STATUS[statusKey];
      const statusEl = $('[data-status]');
      statusEl.className = `status ${st.cls}`;
      $('[data-status-text]').textContent = st.label;
      $('[data-next]').textContent = v.nextStop ? v.nextStop.name : v.headsign;
      $('[data-eta]').textContent = v.nextStop ? formatEta(v.nextStop.etaSec) : statusKey === 'arrived' ? 'Chegou' : '–';
      $('[data-dist]').textContent = v.nextStop ? formatDistance(v.nextStop.distanceM) : '–';
      $('[data-dest]').textContent = v.estimatedArrivalAtDestination;
      $('[data-loc]').textContent = statusKey === 'scheduled' ? `Saída programada às ${v.scheduledDeparture} de ${v.origin}` : vehicleLocationText(v);
      const pct = Math.round(v.progress * 100);
      $('[data-bar]').style.width = `${pct}%`;
      $('[data-progress]').setAttribute('aria-valuenow', String(pct));
      $('[data-pct]').textContent = `${pct}%`;

      const ahead = new Map(v.upcomingStops.map((s) => [s.id, s]));
      const currentId = v.location.atStop?.id;
      map.setStopProgress({
        passedIds: stops.filter((s) => !ahead.has(s.id) && s.id !== currentId).map((s) => s.id),
        nextId: currentId || v.nextStop?.id || null
      });
      $('[data-upcoming]').innerHTML = html`${stops.map((s) => {
        const up = ahead.get(s.id);
        const state = s.id === currentId ? 'is-current' : up ? (up.id === v.nextStop?.id ? 'is-next' : 'is-ahead') : 'is-passed';
        const right = state === 'is-passed' ? html`<small>Passou</small>`
          : state === 'is-current' ? html`<small>${statusKey === 'at_origin' || statusKey === 'scheduled' ? 'Partida' : 'No ponto'}</small>`
            : html`<strong>${formatEta(up.etaSec)}</strong><small>${up.arrivalTime}</small>`;
        return html`<li class="${state}"><a href="${href(`/linha/${line.id}/ponto/${s.id}`)}"><span class="upcoming__dot" aria-hidden="true"></span><span class="upcoming__name">${s.name}</span><span class="upcoming__eta">${right}</span></a></li>`;
      })}`;

      const fin = $('[data-finished]');

      if (clock && statusKey === 'arrived' && fin.dataset.key && fin.dataset.key !== 'arrived' && fin.dataset.key !== 'scheduled') {
        clock.pause();
        clock.reset();
        announce('Viagem concluída. Simulação de volta à hora atual, pausada.');
      }
      if (fin.dataset.key === statusKey) {

      } else if (statusKey === 'arrived' || statusKey === 'scheduled') {
        fin.dataset.key = statusKey;
        fin.hidden = false;
        fin.innerHTML = statusKey === 'arrived'
          ? html`<p>${raw(icons.check())}Esta viagem chegou a ${v.headsign}.</p><button type="button" class="btn btn--primary" data-next-bus>${raw(icons.bus())}Acompanhar próximo ônibus</button>`
          : html`<p>${raw(icons.clock())}Esta viagem parte às ${v.scheduledDeparture}.</p>${clock ? raw(html`<button type="button" class="btn btn--primary" data-jump>${raw(icons.play())}Avançar a simulação até a partida</button>`) : ''}`;
      } else {
        fin.dataset.key = statusKey;
        fin.hidden = true;
      }

      if (v.nextStop && v.nextStop.id !== lastNextId) {
        if (lastNextId) announce(`Próximo ponto: ${v.nextStop.name}, chegada em ${formatEta(v.nextStop.etaSec)}`);
        lastNextId = v.nextStop.id;
      }
    };

    const onSnapshot = async (snap) => {
      if (!el.isConnected) return;
      const inFeed = snap.vehicles.find((x) => x.id === params.vehicleId);
      renderVehicle(inFeed || (await transport.getVehicle(params.vehicleId)));
      map.updateVehicles(snap.vehicles, { animateMs: clock?.playing ? liveFeed.intervalMs : 600 });
      if (follow && introDone && inFeed && !map.followId && !this.userUnfollowed) { map.setFollow(inFeed.id); map.focusVehicle(inFeed.id); }
    };

    map.on('follow', ({ id, byUser }) => {

      if (byUser) { this.userUnfollowed = true; sim?.setFollow(false); }
      else if (id === params.vehicleId) sim?.setFollow(true);
    });

    sim?.show({
      follow: follow,
      onFollowChange: (checked) => {
        this.userUnfollowed = !checked;
        map.setFollow(checked ? params.vehicleId : null);
        if (checked) map.focusVehicle(params.vehicleId);
      },
      onRestart: () => {

        this.userUnfollowed = false;
        clock.pause();
        clock.setSpeed(10);
        clock.jumpTo(hhmmToSec(vehicle.scheduledDeparture) + (vehicle.delaySec || 0));
        map.setFollow(params.vehicleId);
        sim?.setFollow(true);
        announce('Viagem reiniciada no ponto de partida. Simulação pausada.');
      }
    });

    this.off = liveFeed.on('update', onSnapshot);
    await onSnapshot(await liveFeed.watch(line.id));

    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-see-map]')) {

        if (!window.matchMedia('(min-width: 1024px)').matches) ctx.sheet?.set('collapsed');
        this.userUnfollowed = false;
        map.setFollow(params.vehicleId);
        map.focusVehicle(params.vehicleId);
        sim?.setFollow(true);
      }
      if (e.target.closest('[data-jump]')) {
        clock.jumpTo(hhmmToSec(vehicle.scheduledDeparture) + (vehicle.delaySec || 0) - 20);
        clock.setSpeed(10);
        clock.play();
      }
      if (e.target.closest('[data-next-bus]')) {
        const vs = await transport.getVehicles({ lineId: line.id });
        const next = vs.filter((x) => x.directionId === dir.id && x.status !== 'arrived').sort((a, b) => b.progress - a.progress)[0];
        if (next) { navigate(`/veiculo/${next.id}`, { seguir: 1 }); return; }
        const arr = await transport.getArrivals({ lineId: line.id, directionId: dir.id, stopId: stops[0].id, limit: 1 });
        if (arr[0]) navigate(`/veiculo/${arr[0].tripId}`, { seguir: 1 });
      }
    });
  },

  unmount(ctx) {
    this.off?.();
    clearTimeout(this.introTimer);
    this.userUnfollowed = false;
    ctx?.map.setProgressVehicle(null);
    ctx?.map.setFollow(null);
  }
};
