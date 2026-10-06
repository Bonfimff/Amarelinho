import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href } from '../router.js';
import { PLACES, placeAt, snapToRoad } from '../../data/mock/mototaxi/places.js';
import { roads, tilesAround } from '../../data/mock/mototaxi/roads.js';
import { haversine } from '../../lib/geo.js';
import { secToHHMM } from '../../lib/time.js';
import {
  simBadge, money, km, minutes, routeText, ridePill, pill, driverCard, timelineList, formatDistance,
  makeScheduler, bindText, field
} from './common.js';

const OCC_TYPES = ['Conduta do mototaxista', 'Segurança', 'Cobrança acima da tabela', 'Acidente', 'Outro'];

const ui = {
  tab: 'pedir', origin: PLACES[0], dest: null, customs: [], picking: null,

  originMode: 'gps', loc: { status: 'idle' },
  step: 1, draft: { name: '', phone: '' }, rating: 0, shareOpen: false, dismissed: new Set(), occRide: '', lastOcc: null, lastState: {}
};

const placeOptions = () => [...PLACES, ...ui.customs];
const optionsHtml = (selectedId, placeholder = '') => [
  placeholder ? html`<option value="" ${selectedId ? '' : raw('selected')} disabled>${placeholder}</option>` : '',
  ...placeOptions().map((p) => html`<option value="${p.id}" ${p.id === selectedId ? raw('selected') : ''}>${p.name}</option>`)
];

const arrivalText = (sec) => (sec < 45 ? 'O mototaxista mais próximo está a menos de 1 minuto de você.' : `O mototaxista mais próximo chega em cerca de ${minutes(sec)}.`);

function rideLive(w, ride) {
  const d = w.driver(ride.driverId);
  if (!d) return { line: '', sub: '' };
  if (ride.state === 'a_caminho') {
    const dist = w.distanceTo(d, ride.origin);
    return { line: `${d.name} chega em ${minutes(dist / d.speed)}`, sub: `${formatDistance(dist)} até você` };
  }
  if (ride.state === 'no_local') return { line: 'Seu mototaxista chegou', sub: `Confira a placa ${d.moto.plate} e diga o código` };
  if (ride.atDest) return { line: 'Você chegou ao destino', sub: 'O mototaxista vai encerrar a corrida' };
  const rem = w.distanceTo(d, ride.dest);
  return { line: `Chegada em ${minutes(rem / d.speed)}`, sub: `${formatDistance(rem)} até o destino` };
}

const STEPS = ['A caminho', 'Chegou', 'Em viagem', 'Destino'];
const stepOf = (ride) => (ride.state === 'a_caminho' ? 0 : ride.state === 'no_local' ? 1 : ride.atDest ? 3 : 2);

export function mountPassenger(el, scope) {
  const { w, mm, float, ctx } = scope;
  const desktop = () => window.matchMedia('(min-width: 1024px)').matches;
  let lastTrip = 0;
  let tripKey = '';
  let planKey = '';

  const head = () => html`
    <header class="view-head">
      <a class="back" href="${href('/mototaxi')}">${raw(icons.arrowLeft())}Mototáxi</a>
      <p class="ribbon">Mototáxi · Passageiro</p>
      <h1>Pedir mototáxi</h1>
      <p class="muted">${raw(simBadge('Simulação'))} Pedidos, motos e valores desta tela são fictícios.</p>
    </header>
    <div class="segmented" role="tablist" aria-label="Seções do passageiro">
      ${[['pedir', 'Pedir'], ['corridas', 'Minhas corridas'], ['ajuda', 'Ajuda']].map(([k, label]) => html`<button type="button" role="tab" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}" aria-pressed="${ui.tab === k}">${label}</button>`)}
    </div>`;

  const registration = () => html`
    <section class="card">
      <h2 class="card-title">${raw(icons.user())}Cadastro rápido</h2>
      <p class="muted">Só precisamos do seu nome e do número do celular, confirmado por um código. Não pedimos documentos.</p>
      ${ui.step === 1 ? raw(html`
        <form data-form="reg1" class="form">
          ${raw(field('Seu nome', html`<input name="name" type="text" autocomplete="given-name" required minlength="2" value="${ui.draft.name}" data-keep="reg-name" />`))}
          ${raw(field('Celular com DDD', html`<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(21) 90000-0000" value="${ui.draft.phone}" data-keep="reg-phone" />`))}
          <button class="btn btn--primary btn--lg btn--block" type="submit">Receber código</button>
        </form>`) : raw(html`
        <form data-form="reg2" class="form">
          <div class="note" role="note">${raw(icons.info())}<p>Código enviado por SMS (simulado). Nesta demonstração, use <strong>123456</strong>.</p></div>
          ${raw(field('Código de 6 dígitos', html`<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required data-keep="reg-code" />`))}
          <p class="form__error" data-error hidden></p>
          <button class="btn btn--primary btn--lg btn--block" type="submit">Confirmar</button>
          <button class="btn btn--ghost btn--block" type="button" data-act="reg-back">Corrigir número</button>
        </form>`)}
    </section>`;

  let watchId = null;
  const originReady = () => ui.originMode === 'manual' || ui.loc.status === 'ok';

  const applyFix = (pos) => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const snap = snapToRoad(lat, lng);
    const prev = ui.loc.snap?.place;
    const moved = !prev || haversine(prev.lat, prev.lng, snap.place.lat, snap.place.lng) > 25;
    ui.loc = { status: 'ok', lat, lng, accuracy, snap };
    if (ui.originMode === 'gps' && !w.activeRideOfPassenger()) ui.origin = snap.place;

    const missing = tilesAround([[lat, lng]], 1500).filter(([x, y]) => !roads.hasTile(x, y));
    if (missing.length) roads.load(missing).catch(() => {});
    return moved;
  };

  const resnap = () => {
    if (ui.loc.status !== 'ok') return;
    ui.loc.snap = snapToRoad(ui.loc.lat, ui.loc.lng);
    if (ui.originMode === 'gps' && !w.activeRideOfPassenger()) ui.origin = ui.loc.snap.place;
  };

  const startWatch = () => {
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition((pos) => {
      if (applyFix(pos)) sched.schedule(); else syncMap();
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
  };

  const askLocation = () => {
    if (!navigator.geolocation) { ui.loc = { status: 'unsupported' }; sched.now(); return; }
    ui.loc = { status: 'asking' };
    sched.now();
    navigator.geolocation.getCurrentPosition((pos) => {
      applyFix(pos);
      startWatch();
      sched.now();
      mm.fit(mm.bounds([ui.origin, ui.dest]));
    }, (err) => {
      ui.loc = { status: err.code === 1 ? 'denied' : 'error' };
      sched.now();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 });
  };

  const originBlock = () => {
    if (ui.originMode === 'manual') {
      return html`
        <div class="field">
          <label class="field__label" for="m-origin">Embarque</label>
          <div class="field__row">
            <select id="m-origin" data-act="origin" data-keep="origin">${optionsHtml(ui.origin.id)}</select>
            <button type="button" class="btn btn--secondary" data-act="pick" data-kind="origin" aria-pressed="${ui.picking === 'origin'}">${ui.picking === 'origin' ? 'Toque no mapa' : 'No mapa'}</button>
          </div>
          <button type="button" class="linkbtn" data-act="use-gps">Usar a minha localização</button>
        </div>`;
    }
    const l = ui.loc;
    if (l.status === 'ok') {
      const off = l.snap.offM;
      return html`
        <div class="field">
          <span class="field__label">Embarque</span>
          <div class="loc loc--ok loc--row" role="status">
            <span class="loc__dot" aria-hidden="true"></span>
            <div>
              <strong>Sua localização</strong>
              <span>${l.snap.onRoad ? `Na rua mais próxima, perto de ${l.snap.near.name}${off > 60 ? ` (a ${formatDistance(off)} de você)` : ''}` : 'Onde você está'}</span>
            </div>
            <button type="button" class="linkbtn" data-act="manual">Alterar</button>
          </div>
        </div>`;
    }
    if (l.status === 'asking') {
      return html`
        <div class="loc" role="status"><span class="spinner" aria-hidden="true"></span><div><strong>Procurando você</strong><span>Permita o acesso à localização na janela do navegador.</span></div></div>
        <button type="button" class="linkbtn" data-act="manual">Informar o embarque sem a localização</button>`;
    }
    const why = {
      denied: 'A localização está bloqueada neste navegador. Libere no cadeado ao lado do endereço e tente de novo.',
      error: 'Não foi possível obter a sua localização. Confira o GPS ou a conexão.',
      unsupported: 'Este navegador não permite usar a localização.',
      idle: 'O mototaxista vai buscar você onde você está.'
    }[l.status];
    return html`
      <div class="loc loc--ask">
        <span class="loc__dot" aria-hidden="true"></span>
        <div><strong>${l.status === 'idle' ? 'Onde você está?' : 'Sem localização'}</strong><span>${why}</span></div>
      </div>
      <button type="button" class="btn btn--primary btn--block" data-act="loc-ask">${raw(icons.locate())}${l.status === 'idle' ? 'Usar minha localização' : 'Tentar de novo'}</button>
      <button type="button" class="linkbtn" data-act="manual">Informar o embarque sem a localização</button>`;
  };

  const planner = () => {
    const ready = originReady();
    const q = ready && ui.dest ? w.quote(ui.origin, ui.dest) : { valid: false };

    const near = ready ? w.eligibleDrivers(ui.origin, w.rules.despacho.raioInicialM) : [];
    const soonest = near.length ? Math.min(...near.slice(0, 5).map((d) => w.etaTo(d, ui.origin))) : null;
    return html`
      <section class="card">
        <h2 class="card-title">${raw(icons.pin())}Para onde você vai?</h2>
        <div class="form">
          ${raw(originBlock())}
          <div class="field">
            <label class="field__label" for="m-dest">Destino</label>
            <div class="field__row">
              <select id="m-dest" data-act="dest" data-keep="dest">${optionsHtml(ui.dest?.id, 'Escolha o destino')}</select>
              <button type="button" class="btn btn--secondary" data-act="pick" data-kind="dest" aria-pressed="${ui.picking === 'dest'}">${ui.picking === 'dest' ? 'Toque no mapa' : 'No mapa'}</button>
            </div>
          </div>
          ${ui.picking ? raw(html`<p class="note note--warn" role="note">${raw(icons.info())}<span>Toque no mapa para escolher o ${ui.picking === 'origin' ? 'embarque' : 'destino'}.</span></p>`) : ''}
        </div>
        ${ready ? raw(html`
          <div class="order" aria-live="polite">
            ${q.valid ? raw(html`
              <p class="order__fare"><strong>${money(q.fare)}</strong><span>${km(q.distanceM)} · cerca de ${minutes(q.durationSec)} de viagem</span></p>`)
              : raw(html`<p class="muted">${ui.dest ? 'Escolha um destino a pelo menos 200 m do embarque.' : 'Escolha o destino para ver o valor.'}</p>`)}
            <button class="btn btn--primary btn--lg btn--block" type="button" data-act="request" ${q.valid ? '' : raw('disabled')}>${raw(icons.moto())}Pedir mototáxi</button>
            <p class="fine">${near.length ? arrivalText(soonest) : 'Nenhum mototaxista perto agora. Ao pedir, a busca é ampliada.'} Pagamento direto ao mototaxista, em dinheiro ou Pix.</p>
          </div>`) : ''}
        <p class="fine">Sua localização só marca o embarque e não sai do seu aparelho. Valores fictícios nesta demonstração.</p>
      </section>`;
  };

  const rideCard = (ride) => {
    const d = w.driver(ride.driverId);
    const live = rideLive(w, ride);
    if (ride.state === 'ofertada') {
      return html`
        <section class="card ride">
          <p class="ride__route">${raw(routeText(ride))}</p>
          <div class="ride__status">
            <span class="spinner" aria-hidden="true"></span>
            <div>
              <strong>Procurando mototaxista</strong>
              <span>${ride.round === 2 ? 'Ampliando a busca para mais longe.' : 'Chamando o mais próximo. Costuma levar menos de 1 minuto.'}</span>
            </div>
          </div>
          <p class="ride__fare"><strong>${money(ride.fare)}</strong> pago direto ao mototaxista</p>
          <div class="actions"><button class="btn btn--secondary" type="button" data-act="cancel">Cancelar pedido</button></div>
        </section>`;
    }
    return html`
      <section class="card ride">
        <p class="ride__route">${raw(routeText(ride))}</p>
        <div class="ride__status ride__status--live" ${ride.state === 'no_local' ? raw('role="alert"') : ''}>
          <div>
            <strong data-bind="live-line">${live.line}</strong>
            <span data-bind="live-sub">${live.sub}</span>
          </div>
        </div>
        <ol class="steps" aria-label="Andamento da corrida">${STEPS.map((t, i) => html`<li class="${i < stepOf(ride) ? 'is-done' : ''} ${i === stepOf(ride) ? 'is-now' : ''}" ${i === stepOf(ride) ? raw('aria-current="step"') : ''}><span aria-hidden="true"></span>${t}</li>`)}</ol>
        ${raw(driverCard(w, d))}
        ${['a_caminho', 'no_local'].includes(ride.state) ? raw(html`
          <div class="pin">
            <span class="field__label">Código de embarque</span>
            <strong class="pin__code" aria-label="Código ${ride.pin.split('').join(' ')}">${ride.pin}</strong>
            <span class="fine">Diga este código ao mototaxista para começar a corrida.</span>
          </div>`) : ''}
        <p class="ride__fare"><strong>${money(ride.fare)}</strong> pago direto ao mototaxista</p>
        <div class="actions">
          ${ride.state !== 'em_corrida' ? raw(html`<button class="btn btn--secondary" type="button" data-act="cancel">Cancelar corrida</button>`) : ''}
          <button class="btn btn--ghost" type="button" data-act="share" aria-expanded="${ui.shareOpen}">${raw(icons.external())}Compartilhar trajeto</button>
        </div>
        ${ui.shareOpen ? raw(html`<div class="note" role="note">${raw(icons.info())}<div><p>Exemplo de link para uma pessoa de confiança: <strong>amarelinho.exksvol.com/#/mototaxi/${ride.id}</strong></p><p class="fine">Na versão real, quem recebesse o link acompanharia a moto até o fim da corrida.</p></div></div>`) : ''}
        <button type="button" class="linkbtn" data-act="occ-ride" data-id="${ride.id}">Precisa de ajuda ou quer relatar um problema?</button>
      </section>`;
  };

  const finished = (ride) => {
    if (ride.state === 'concluida') {
      return html`
        <section class="card ride">
          <h2 class="card-title">${raw(icons.check())}Você chegou</h2>
          <p class="ride__route">${raw(routeText(ride))}</p>
          <p class="ride__fare"><strong>${money(ride.fare)}</strong> pague direto ao mototaxista</p>
          ${ride.rating ? raw(html`<p class="ride__thanks">${raw(icons.check())}Obrigado pela avaliação: ${ride.rating} de 5.</p>`) : raw(html`
            <div class="rate">
              <p class="field__label" id="rate-label">Como foi a corrida com ${w.driver(ride.driverId).name}?</p>
              <div class="rate__stars" role="group" aria-labelledby="rate-label">
                ${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-act="star" data-v="${n}" aria-pressed="${ui.rating === n}" aria-label="${n} de 5" class="${ui.rating >= n ? 'is-on' : ''}">${raw(icons.star('star-ico'))}</button>`)}
              </div>
              ${ui.rating ? raw(html`
                <textarea name="comment" rows="2" placeholder="Quer comentar? (opcional)" data-keep="comment" aria-label="Comentário sobre a corrida"></textarea>
                <button class="btn btn--secondary btn--block" type="button" data-act="rate-send">Enviar avaliação</button>`) : ''}
            </div>`)}
          <button class="btn btn--primary btn--lg btn--block" type="button" data-act="dismiss" data-id="${ride.id}">Nova corrida</button>
          <button type="button" class="linkbtn" data-act="occ-ride" data-id="${ride.id}">Cobraram diferente da tabela ou houve algum problema?</button>
        </section>`;
    }
    const sem = ride.state === 'sem_aceite';
    return html`
      <section class="card ride">
        <h2 class="card-title">${sem ? 'Nenhum mototaxista disponível' : 'Pedido cancelado'}</h2>
        <p class="ride__route">${raw(routeText(ride))}</p>
        ${sem ? raw(html`<p>Ninguém por perto aceitou agora. Tente de novo em instantes.</p>`) : ''}
        <button class="btn btn--primary btn--lg btn--block" type="button" data-act="dismiss" data-id="${ride.id}">${sem ? 'Tentar de novo' : 'Fazer novo pedido'}</button>
      </section>`;
  };

  const pedir = () => {
    const active = w.activeRideOfPassenger();
    if (active) return rideCard(active);
    const last = w.ridesOfPassenger()[0];
    if (last && !ui.dismissed.has(last.id) && ['concluida', 'cancelada', 'sem_aceite'].includes(last.state)) return finished(last);
    return planner();
  };

  const corridas = () => {
    const list = w.ridesOfPassenger();
    return list.length ? html`<ul class="cards">${list.map((r) => html`
      <li><details class="card ridelog" data-key="pr-${r.id}">
        <summary>
          <span class="ridelog__top"><strong>${r.id}</strong> ${raw(ridePill(r.state))}</span>
          <span class="ridelog__route">${raw(routeText(r))}</span>
          <span class="ridelog__meta">${secToHHMM(r.createdSim)} · ${km(r.distanceM)} · ${money(r.fare)}${r.rating ? ` · nota ${r.rating}` : ''}</span>
        </summary>
        ${raw(timelineList(r.events))}
      </details></li>`)}</ul>` : html`<p class="empty">Você ainda não fez nenhuma corrida nesta demonstração.</p>`;
  };

  const ajuda = () => {
    const mine = w.occurrences.filter((o) => o.mine && o.by === 'passageiro');
    const rides = w.ridesOfPassenger();
    return html`
      <section class="card">
        <h2 class="card-title">${raw(icons.shield())}Segurança</h2>
        <ul class="plain-list">
          <li>Antes de embarcar, confira nome, foto, placa e número de credencial do mototaxista no aplicativo.</li>
          <li>Só entre numa moto que tenha aceitado o seu pedido.</li>
          <li>Use "Compartilhar trajeto" para avisar alguém de confiança.</li>
        </ul>
      </section>
      <section class="card">
        <h2 class="card-title">${raw(icons.alert())}Registrar ocorrência</h2>
        <form data-form="occ" class="form">
          ${raw(field('Tipo', html`<select name="type" data-keep="occ-type">${OCC_TYPES.map((t) => html`<option>${t}</option>`)}</select>`))}
          ${raw(field('Corrida (opcional)', html`<select name="ride" data-keep="occ-ride"><option value="">Nenhuma em particular</option>${rides.map((r) => html`<option value="${r.id}" ${r.id === ui.occRide ? raw('selected') : ''}>${r.id}: ${r.origin.name} para ${r.dest.name}</option>`)}</select>`))}
          ${raw(field('O que aconteceu', html`<textarea name="text" rows="3" required minlength="5" data-keep="occ-text"></textarea>`))}
          <button class="btn btn--primary btn--block" type="submit">Enviar à Secretaria</button>
        </form>
        ${ui.lastOcc ? raw(html`<p class="ride__thanks">${raw(icons.check())}Ocorrência registrada. Protocolo <strong>${ui.lastOcc}</strong>.</p>`) : ''}
      </section>
      ${mine.length ? raw(html`<section class="card"><h2 class="card-title">Minhas ocorrências</h2><ul class="cards">${mine.map((o) => html`
        <li class="occ"><span class="ridelog__top"><strong>${o.id}</strong> ${raw(pill(o.status === 'aberta' ? 'Aberta' : o.status === 'em_analise' ? 'Em análise' : 'Resolvida', o.status === 'resolvida' ? 'ok' : 'info'))}</span>
        <span>${o.type}</span>${o.reply ? raw(html`<span class="occ__reply"><b>Resposta da Secretaria:</b> ${o.reply}</span>`) : ''}</li>`)}</ul></section>`) : ''}`;
  };

  const render = () => {
    let body;
    if (!w.passenger.registered) body = registration();
    else if (ui.tab === 'pedir') body = pedir();
    else if (ui.tab === 'corridas') body = corridas();
    else body = ajuda();
    el.innerHTML = html`${raw(head())}<div class="tab-panel" role="tabpanel">${raw(body)}</div>`;
    syncMap(true);
    tick();
  };
  const sched = makeScheduler(el, render);

  function syncMap(structural = false) {
    const active = w.passenger.registered && ui.tab === 'pedir' ? w.activeRideOfPassenger() : null;
    const asDriver = (x, extra = {}) => w.driverView(x, extra);

    const here = ui.loc.status === 'ok' && w.passenger.registered && ui.tab === 'pedir' ? ui.loc : null;
    mm.setUser(here);
    if (active) {
      const d = w.driver(active.driverId);

      mm.setDrivers(d ? [asDriver(d, { selected: true })] : []);
      const key = `${active.id}|${active.state}`;
      planKey = '';

      mm.setTrip({ ...w.tripView(active), driverId: d?.id });
      if (structural || key !== tripKey || performance.now() - lastTrip > 900) {
        mm.setWalk(here && active.origin.source === 'gps' && active.origin.offM > 25 ? here : null, active.origin);
        lastTrip = performance.now();
      }
      if (key !== tripKey) {
        tripKey = key;

        const onTheWay = ['a_caminho', 'no_local'].includes(active.state);
        mm.follow(active.state === 'em_corrida');
        const items = onTheWay ? [active.origin, d] : [active.origin, active.dest, d];
        if (active.state !== 'em_corrida') mm.fit(mm.bounds(items));
      }
      if (active.state === 'em_corrida' && d) mm.track(d);
    } else {
      const showPlan = w.passenger.registered && ui.tab === 'pedir';
      mm.follow(false);
      mm.setDrivers([]);
      if (showPlan && originReady()) {
        const k = `${ui.origin.id}|${ui.origin.lat}|${ui.dest?.id}|${roads.edgeCount}`;
        if (structural || planKey !== k) {
          planKey = k;
          mm.setTrip({ origin: ui.origin, dest: ui.dest, plan: ui.dest ? w.planPath(ui.origin, ui.dest) : null });
        }
      } else { mm.setTrip({}); planKey = ''; }
      mm.setWalk(showPlan && here && ui.origin.source === 'gps' && ui.origin.offM > 25 ? here : null, showPlan ? ui.origin : null);
      tripKey = '';
    }
  }

  function tick() {
    const active = w.activeRideOfPassenger();
    if (!active) { float.setStatus(!w.passenger.registered ? 'Faça o cadastro rápido para pedir.' : originReady() ? 'Pronto para pedir uma corrida.' : 'Aguardando a sua localização para marcar o embarque.'); return; }
    if (active.state === 'ofertada') {
      const o = active.currentOffer && active.offers[active.currentOffer];
      const left = o ? Math.max(0, Math.ceil(o.expiresT - w.t)) : 0;
      float.setStatus(`${active.id}: procurando mototaxista${o ? ` (oferta ${active.queueIdx} de ${active.queue.length}, ${left} s)` : ''}`);
      return;
    }
    const live = rideLive(w, active);
    bindText(el, { 'live-line': live.line, 'live-sub': live.sub });
    float.setStatus(`${active.id}: ${live.line.toLowerCase()}`);
  }

  const offs = [
    w.on('tick', () => { syncMap(); tick(); }),
    w.on('change', ({ topic, id }) => {
      if (topic === 'ride') {
        const r = w.ride(id);
        if (r?.passenger.isUser) handleRideChange(r);
      }
      if (topic === 'roads') resnap();
      if (['ride', 'drivers', 'occurrences', 'reset', 'passenger', 'roads'].includes(topic)) sched.schedule();
    })
  ];

  function handleRideChange(r) {
    const prev = ui.lastState[r.id];
    ui.lastState[r.id] = r.state;
    if (prev === r.state) return;
    if (!desktop()) {
      if (r.state === 'a_caminho' && prev === 'ofertada') ctx.sheet.set('collapsed');
      if (['concluida', 'cancelada', 'sem_aceite'].includes(r.state)) ctx.sheet.set('full');
    }
    if (r.state === 'concluida' || r.state === 'cancelada' || r.state === 'sem_aceite') ui.rating = 0;
    ctx.announce(`Corrida ${r.id}: ${r.state.replace('_', ' ')}.`);
  }

  const rerender = () => { sched.now(); };

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const act = b.dataset.act;
    if (act === 'tab') { ui.tab = b.dataset.tab; ui.picking = null; mm.pickMode(null); rerender(); if (ui.tab === 'pedir') mm.fit(); }
    else if (act === 'loc-ask') askLocation();
    else if (act === 'manual') { ui.originMode = 'manual'; rerender(); mm.fit(mm.bounds([ui.origin, ui.dest])); }
    else if (act === 'use-gps') { ui.originMode = 'gps'; ui.picking = null; mm.pickMode(null); if (ui.loc.status === 'ok') ui.origin = ui.loc.snap.place; rerender(); if (ui.loc.status !== 'ok') askLocation(); }
    else if (act === 'pick') {
      ui.picking = ui.picking === b.dataset.kind ? null : b.dataset.kind;
      mm.pickMode(ui.picking ? ({ lat, lng }) => {
        const place = placeAt(lat, lng);
        if (!PLACES.some((p) => p.id === place.id) && !ui.customs.some((p) => p.id === place.id)) ui.customs.push(place);
        if (ui.picking === 'origin') ui.origin = place; else ui.dest = place;
        ui.picking = null;
        mm.pickMode(null);
        rerender();
      } : null);
      if (ui.picking && !desktop()) ctx.sheet.set('collapsed');
      rerender();
    }
    else if (act === 'request') { if (originReady() && ui.dest) w.requestRide({ origin: ui.origin, dest: ui.dest }); ui.shareOpen = false; rerender(); }
    else if (act === 'cancel') { const r = w.activeRideOfPassenger(); if (r) w.cancelRide(r.id, 'passageiro', 'a pedido do passageiro'); rerender(); }
    else if (act === 'share') { ui.shareOpen = !ui.shareOpen; rerender(); }
    else if (act === 'star') { ui.rating = Number(b.dataset.v); rerender(); }
    else if (act === 'rate-send') {
      const r = w.ridesOfPassenger()[0];
      w.rateRide(r.id, ui.rating, el.querySelector('[name="comment"]')?.value || '');
      rerender();
    }
    else if (act === 'dismiss') { ui.dismissed.add(b.dataset.id); ui.rating = 0; rerender(); mm.fit(); }
    else if (act === 'occ-ride') { ui.tab = 'ajuda'; ui.occRide = b.dataset.id; ui.lastOcc = null; rerender(); }
    else if (act === 'reg-back') { ui.step = 1; rerender(); }
  };

  const onChange = (e) => {
    const s = e.target.closest('select[data-act]');
    if (!s) return;
    const place = placeOptions().find((p) => p.id === s.value);
    if (!place) return;
    if (s.dataset.act === 'origin') ui.origin = place; else ui.dest = place;
    rerender();

    if (ui.dest && originReady()) mm.fit(mm.bounds([ui.origin, ui.dest]));
  };

  const onSubmit = (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    const kind = form.dataset.form;
    if (kind === 'reg1') {
      ui.draft = { name: String(data.get('name')).trim(), phone: String(data.get('phone')).trim() };
      if (ui.draft.name.length < 2 || ui.draft.phone.replace(/\D/g, '').length < 10) return;
      ui.step = 2;
      rerender();
    } else if (kind === 'reg2') {
      if (String(data.get('code')).trim() !== '123456') {
        const err = form.querySelector('[data-error]');
        err.textContent = 'Código incorreto. Nesta demonstração, use 123456.';
        err.hidden = false;
        return;
      }
      w.passengerRegister(ui.draft);
      ui.step = 1;
      rerender();
    } else if (kind === 'occ') {
      const occ = w.openOccurrence({ by: 'passageiro', rideId: String(data.get('ride')) || null, type: String(data.get('type')), text: String(data.get('text')) });
      ui.lastOcc = occ.id;
      ui.occRide = '';
      rerender();
    }
  };

  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('submit', onSubmit);
  mm.onDriver(() => {});
  mm.fit();
  render();

  if (ui.loc.status === 'ok') startWatch();
  else if (ui.loc.status === 'idle' && navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((p) => { if (p.state === 'granted' && ui.loc.status === 'idle') askLocation(); }).catch(() => {});
  }

  return function unmount() {
    offs.forEach((f) => f());
    sched.destroy();
    el.removeEventListener('click', onClick);
    el.removeEventListener('change', onChange);
    el.removeEventListener('submit', onSubmit);
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    mm.setUser(null);
    mm.setWalk(null, null);
    mm.follow(false);
    mm.pickMode(null);
    ui.picking = null;
  };
}

export function resetPassengerUi() {
  Object.assign(ui, { tab: 'pedir', origin: ui.loc.snap?.place || PLACES[0], dest: null, customs: [], picking: null, originMode: ui.loc.status === 'ok' ? 'gps' : ui.originMode, step: 1, draft: { name: '', phone: '' }, rating: 0, shareOpen: false, occRide: '', lastOcc: null });
  ui.dismissed.clear();
  ui.lastState = {};
}
