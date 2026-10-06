import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href } from '../router.js';
import { DOC_TYPES } from '../../data/mock/mototaxi/seed.js';
import { secToHHMM } from '../../lib/time.js';
import {
  simBadge, money, km, minutes, stars, routeText, ridePill, regPill, docPill, pill, timelineList, formatDistance,
  makeScheduler, bindText, field, initial, openKeeper
} from './common.js';

const GIVE_UP = ['Problema com a moto', 'Não encontrei o passageiro', 'Outro motivo'];
const OCC_TYPES = ['Conduta do passageiro', 'Segurança', 'Cobrança', 'Acidente', 'Outro'];

const ui = { tab: 'corridas', profile: null, giveUp: false, pinError: false, pRating: 0, pDismissed: new Set(), lastOcc: null, seenOffers: new Set(), lastState: {} };

const firstName = (n) => n.split(' ')[0];

export function mountDriver(el, scope, { onRestart }) {
  const { w, mm, float, ctx } = scope;
  const desktop = () => window.matchMedia('(min-width: 1024px)').matches;
  const me = () => w.userDriver;
  const keeper = openKeeper(el);
  let tripKey = '';
  if (!ui.profile) ui.profile = { name: me().name, phone: me().phone, model: me().moto.model, color: me().moto.color, plate: me().moto.plate };

  const editable = () => ['nao_cadastrado', 'pendencia'].includes(me().reg);
  const profileComplete = () => ['name', 'phone', 'model', 'color', 'plate'].every((k) => ui.profile[k].trim().length >= 2);
  const docsComplete = () => DOC_TYPES.every((x) => ['enviado', 'aprovado'].includes(me().docs[x.id]));

  const head = () => {
    const d = me();
    return html`
      <header class="view-head">
        <a class="back" href="${href('/mototaxi')}">${raw(icons.arrowLeft())}Mototáxi</a>
        <p class="ribbon">Mototáxi · Mototaxista</p>
        <h1>${d.name ? `Olá, ${firstName(d.name)}` : 'Mototaxista'}</h1>
        <p class="muted">${raw(regPill(d.reg))} ${raw(simBadge('Simulação'))}</p>
      </header>
      <div class="segmented" role="tablist" aria-label="Seções do mototaxista">
        ${[['corridas', 'Corridas'], ['historico', 'Histórico e ganhos'], ['cadastro', 'Cadastro']].map(([k, label]) => html`<button type="button" role="tab" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}" aria-pressed="${ui.tab === k}">${label}</button>`)}
      </div>`;
  };

  const blocked = () => {
    const d = me();
    const msg = {
      nao_cadastrado: html`Você ainda não tem cadastro. Envie seus dados e documentos na aba <strong>Cadastro</strong> para receber pedidos.`,
      em_analise: html`Seu cadastro está em análise pela Secretaria. Nesta demonstração, abra a <a href="${href('/mototaxi/secretaria')}">área da Secretaria</a>, vá em Cadastros e aprove.`,
      pendencia: html`A Secretaria pediu correções: <strong>${d.regNote}</strong> Ajuste na aba <strong>Cadastro</strong> e envie de novo.`,
      suspenso: html`Seu cadastro está suspenso. Motivo: <strong>${d.regNote}</strong>`,
      cancelado: html`Seu credenciamento foi cancelado. Motivo: <strong>${d.regNote}</strong>`
    }[d.reg];
    return html`<section class="card"><div class="note note--warn" role="note">${raw(icons.info())}<p>${raw(msg)}</p></div>
      ${['nao_cadastrado', 'pendencia'].includes(d.reg) ? raw(html`<button class="btn btn--primary btn--block" type="button" data-act="tab" data-tab="cadastro">Ir para o cadastro</button>`) : ''}</section>`;
  };

  const availability = (ride) => {
    const d = me();
    return html`
      <section class="card">
        <label class="switch switch--big">
          <input type="checkbox" data-act="online" data-keep="online" ${d.online || ride ? raw('checked') : ''} ${ride ? raw('disabled') : ''} />
          <span class="switch__track" aria-hidden="true"></span>
          <span><strong>${ride ? 'Em corrida' : d.online ? 'Disponível para corridas' : 'Offline'}</strong></span>
        </label>
        <p class="fine">Enquanto estiver disponível, a posição da sua moto é enviada à plataforma. Offline, nada é enviado.</p>
      </section>`;
  };

  const offerCard = (ride) => {
    const d = me();
    const toPickup = w.distanceTo(d, ride.origin);
    const score = w.passengerScore(ride);
    return html`
      <section class="card offer">
        <div class="offer__head">
          <div>
            <h2 class="card-title">${raw(icons.moto())}Novo pedido</h2>
            <p class="offer__who">${ride.passenger.name} · ${score == null ? 'passageiro novo' : raw(html`${raw(icons.star('star-ico'))} ${score.toFixed(1).replace('.', ',')}`)}</p>
          </div>
          <span class="ring" data-ring data-offer="${ride.id}" role="timer" aria-label="Tempo para aceitar"><b data-bind="offer-${ride.id}"></b></span>
        </div>
        <p class="offer__big"><strong>${minutes(toPickup / d.speed)}</strong> <span>até o passageiro (${formatDistance(toPickup)})</span></p>
        <p class="ride__route">${raw(routeText(ride))}</p>
        <dl class="facts facts--3">
          <div><dt>Corrida</dt><dd>${km(ride.distanceM)}</dd></div>
          <div><dt>Duração</dt><dd>${minutes(ride.distanceM / d.speed)}</dd></div>
          <div><dt>Valor</dt><dd>${money(ride.fare)}</dd></div>
        </dl>
        <p class="fine">O valor é o da tabela, pago direto a você pelo passageiro. A oferta passa para outro profissional se você recusar ou o tempo acabar.</p>
        <div class="actions">
          <button class="btn btn--primary btn--lg" type="button" data-act="accept" data-id="${ride.id}">Aceitar</button>
          <button class="btn btn--secondary btn--lg" type="button" data-act="decline" data-id="${ride.id}">Recusar</button>
        </div>
      </section>`;
  };

  const activeCard = (ride) => {
    const d = me();
    const toPickup = w.distanceTo(d, ride.origin);
    const rem = w.distanceTo(d, ride.dest);
    const pct = ride.state === 'em_corrida' ? Math.round((1 - rem / Math.max(1, ride.distanceM)) * 100) : 0;
    return html`
      <section class="card ride">
        <div class="card-head"><h2 class="card-title">Corrida ${ride.id}</h2>${raw(ridePill(ride.state))}</div>
        <p class="ride__route">${raw(routeText(ride))}</p>
        <div class="person"><span class="person__avatar" aria-hidden="true">${initial(ride.passenger.name)}</span><div class="person__body"><strong>${ride.passenger.name}</strong><span>${ride.passenger.phone || 'Telefone protegido pela plataforma'}</span></div></div>
        <div class="ride__status ride__status--live">
          <div>
            <strong data-bind="d-line">${ride.state === 'a_caminho' ? `Chegue ao passageiro em ${minutes(toPickup / d.speed)}` : ride.state === 'no_local' ? 'Você chegou ao embarque' : ride.atDest ? 'Você chegou ao destino' : `Destino em ${minutes(rem / d.speed)}`}</strong>
            <span data-bind="d-sub">${ride.state === 'a_caminho' ? `${formatDistance(toPickup)} até o embarque` : ride.state === 'no_local' ? 'Confira o nome do passageiro e inicie a corrida.' : ride.atDest ? 'Finalize a corrida.' : `${formatDistance(rem)} restantes`}</span>
          </div>
        </div>
        ${ride.state === 'em_corrida' ? raw(html`<div class="progress" role="progressbar" aria-label="Progresso da corrida" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="progress__bar" data-progress style="width:${pct}%"></span></div>`) : ''}
        <dl class="facts facts--2">
          <div><dt>Receber do passageiro</dt><dd>${money(ride.fare)}</dd></div>
          <div><dt>Distância</dt><dd>${km(ride.distanceM)}</dd></div>
        </dl>
        <div class="actions">
          ${ride.state === 'em_corrida' ? raw(html`<button class="btn btn--primary btn--lg" type="button" data-act="finish" data-id="${ride.id}" ${ride.atDest ? '' : raw('disabled')}>Finalizar corrida</button>`) : ''}
          ${['a_caminho', 'no_local'].includes(ride.state) ? raw(html`<button class="btn btn--secondary" type="button" data-act="giveup-toggle" aria-expanded="${ui.giveUp}">Desistir da corrida</button>`) : ''}
        </div>
        ${ride.state === 'no_local' ? raw(html`
          <form class="form form--box" data-form="start" data-id="${ride.id}">
            ${raw(field('Código de embarque do passageiro', html`<input name="pin" type="text" inputmode="numeric" maxlength="4" autocomplete="off" required data-keep="pin" />`, `Peça o código ao passageiro. Demonstração: o código é ${ride.pin}.`))}
            ${ui.pinError ? raw(html`<p class="form__error" role="alert">Código incorreto. Peça o código ao passageiro.</p>`) : ''}
            <button class="btn btn--primary btn--lg btn--block" type="submit">Iniciar corrida</button>
          </form>`) : ''}
        ${ui.giveUp && ['a_caminho', 'no_local'].includes(ride.state) ? raw(html`
          <form class="form" data-form="giveup">
            ${raw(field('Motivo', html`<select name="reason" data-keep="giveup">${GIVE_UP.map((r) => html`<option>${r}</option>`)}</select>`))}
            <p class="fine">O pedido volta para a fila e será oferecido a outro profissional.</p>
            <button class="btn btn--secondary btn--block" type="submit">Confirmar desistência</button>
          </form>`) : ''}
      </section>
      <section class="card"><h2 class="card-title">${raw(icons.clock())}O que aconteceu</h2>${raw(timelineList(ride.events))}</section>`;
  };

  const occurrence = () => {
    const mine = w.occurrences.filter((o) => o.mine && o.by === 'mototaxista');
    return html`
      <details class="card ridelog" data-key="d-occ" ${keeper.attr('d-occ')}>
        <summary><span class="ridelog__top"><strong class="card-title">${raw(icons.alert())}Registrar ocorrência</strong></span></summary>
        <form data-form="occ" class="form">
          ${raw(field('Tipo', html`<select name="type" data-keep="docc-type">${OCC_TYPES.map((t) => html`<option>${t}</option>`)}</select>`))}
          ${raw(field('O que aconteceu', html`<textarea name="text" rows="3" required minlength="5" data-keep="docc-text"></textarea>`))}
          <button class="btn btn--primary btn--block" type="submit">Enviar à Secretaria</button>
        </form>
        ${ui.lastOcc ? raw(html`<p class="ride__thanks">${raw(icons.check())}Ocorrência registrada. Protocolo <strong>${ui.lastOcc}</strong>.</p>`) : ''}
        ${mine.length ? raw(html`<ul class="cards">${mine.map((o) => html`<li class="occ"><span class="ridelog__top"><strong>${o.id}</strong> ${raw(pill(o.status === 'resolvida' ? 'Resolvida' : 'Aberta', o.status === 'resolvida' ? 'ok' : 'info'))}</span><span>${o.type}</span>${o.reply ? raw(html`<span class="occ__reply"><b>Resposta:</b> ${o.reply}</span>`) : ''}</li>`)}</ul>`) : ''}
      </details>`;
  };

  const corridas = () => {
    const d = me();
    if (d.reg !== 'aprovado') return html`${raw(blocked())}`;
    const ride = w.activeRideOfDriver(d.id);
    const offers = w.offersFor(d.id);
    const lastDone = w.ridesOfDriver(d.id)[0];
    const rateCard = !ride && lastDone?.state === 'concluida' && !lastDone.passengerRating && !ui.pDismissed.has(lastDone.id) ? html`
      <section class="card rate">
        <h2 class="card-title">${raw(icons.check())}Corrida concluída</h2>
        <p class="field__label" id="prate-label">Como foi o passageiro ${lastDone.passenger.name}?</p>
        <div class="rate__stars" role="group" aria-labelledby="prate-label">
          ${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-act="pstar" data-v="${n}" aria-pressed="${ui.pRating === n}" aria-label="${n} de 5" class="${ui.pRating >= n ? 'is-on' : ''}">${raw(icons.star('star-ico'))}</button>`)}
        </div>
        <div class="actions">
          <button class="btn btn--primary" type="button" data-act="prate" data-id="${lastDone.id}" ${ui.pRating ? '' : raw('disabled')}>Enviar avaliação</button>
          <button class="btn btn--ghost" type="button" data-act="pskip" data-id="${lastDone.id}">Pular</button>
        </div>
      </section>` : '';
    return html`
      ${raw(availability(ride))}
      ${raw(rateCard)}
      ${ride ? raw(activeCard(ride)) : d.online
        ? (offers.length ? raw(html`${offers.map((r) => offerCard(r))}`) : raw(html`<section class="card"><div class="ride__status"><span class="spinner" aria-hidden="true"></span><div><strong>Aguardando pedidos</strong><span>Você aparece como disponível para passageiros perto de você.</span></div></div></section>`))
        : raw(html`<p class="empty">Ative a disponibilidade para receber pedidos.</p>`)}
      ${raw(occurrence())}`;
  };

  const historico = () => {
    const d = me();
    const list = w.ridesOfDriver(d.id);
    const done = list.filter((r) => r.state === 'concluida');
    const total = done.reduce((s, r) => s + r.fare, 0);
    const rating = w.rating(d.id);
    return html`
      <section class="card">
        <h2 class="card-title">Hoje</h2>
        <dl class="facts facts--2">
          <div><dt>Corridas concluídas</dt><dd>${done.length}</dd></div>
          <div><dt>Distância</dt><dd>${km(done.reduce((s, r) => s + r.distanceM, 0))}</dd></div>
          <div><dt>Valor pela tabela</dt><dd>${money(total)}</dd></div>
          <div><dt>Nota média</dt><dd>${stars(rating)}</dd></div>
          <div><dt>Taxa de aceite</dt><dd>${w.acceptRate(d.id) == null ? 'sem ofertas' : `${Math.round(w.acceptRate(d.id) * 100)}%`}</dd></div>
          <div><dt>Desistências</dt><dd>${d.cancelled}</dd></div>
        </dl>
        <p class="fine">Como o pagamento é feito direto pelo passageiro, o valor acima é o da tabela, não um saldo na plataforma. Repasse e saldo ficam para uma versão futura, se a Secretaria decidir.</p>
      </section>
      ${list.length ? raw(html`<ul class="cards">${list.map((r) => html`
        <li><details class="card ridelog" data-key="dr-${r.id}">
          <summary>
            <span class="ridelog__top"><strong>${r.id}</strong> ${raw(ridePill(r.state))}</span>
            <span class="ridelog__route">${raw(routeText(r))}</span>
            <span class="ridelog__meta">${secToHHMM(r.createdSim)} · ${km(r.distanceM)} · ${money(r.fare)}${r.rating ? ` · nota ${r.rating}` : ''}</span>
          </summary>
          ${raw(timelineList(r.events))}
        </details></li>`)}</ul>`) : raw(html`<p class="empty">Nenhuma corrida ainda.</p>`)}`;
  };

  const cadastro = () => {
    const d = me();
    const edit = editable();
    const p = ui.profile;
    return html`
      <section class="card">
        <h2 class="card-title">${raw(icons.user())}Dados do profissional</h2>
        ${d.regNote && d.reg === 'pendencia' ? raw(html`<div class="note note--warn" role="note">${raw(icons.info())}<p><strong>Pendência.</strong> ${d.regNote}</p></div>`) : ''}
        <form data-form="profile" class="form">
          ${raw(field('Nome completo', html`<input name="name" type="text" required value="${p.name}" ${edit ? '' : raw('readonly')} data-keep="p-name" />`))}
          ${raw(field('Celular com DDD', html`<input name="phone" type="tel" required value="${p.phone}" ${edit ? '' : raw('readonly')} data-keep="p-phone" />`))}
          ${raw(field('Modelo da moto', html`<input name="model" type="text" required value="${p.model}" ${edit ? '' : raw('readonly')} data-keep="p-model" />`))}
          <div class="field__row">
            ${raw(field('Cor', html`<input name="color" type="text" required value="${p.color}" ${edit ? '' : raw('readonly')} data-keep="p-color" />`))}
            ${raw(field('Placa', html`<input name="plate" type="text" required value="${p.plate}" ${edit ? '' : raw('readonly')} data-keep="p-plate" />`))}
          </div>
        </form>
      </section>
      <section class="card">
        <h2 class="card-title">${raw(icons.shield())}Documentos</h2>
        <p class="fine">Lista de exemplo: a Secretaria define os documentos exigidos, com base na legislação federal e municipal. Nesta demonstração, "Anexar" apenas marca o documento como enviado.</p>
        <ul class="docs">${DOC_TYPES.map((x) => html`
          <li><span class="docs__name">${x.label}</span>${raw(docPill(d.docs[x.id]))}
            ${edit && ['pendente', 'recusado', 'vencido'].includes(d.docs[x.id]) ? raw(html`<button class="btn btn--secondary btn--sm" type="button" data-act="doc" data-id="${x.id}">Anexar</button>`) : ''}</li>`)}</ul>
        ${edit ? raw(html`<button class="btn btn--primary btn--lg btn--block" type="button" data-act="submit" ${profileComplete() && docsComplete() ? '' : raw('disabled')}>Enviar para análise</button>
          ${profileComplete() && docsComplete() ? '' : raw(html`<p class="fine">Preencha os dados e anexe os cinco documentos para enviar.</p>`)}`) : ''}
      </section>
      ${d.reg === 'aprovado' ? raw(html`
      <section class="card credential">
        <h2 class="card-title">${raw(icons.shield())}Credencial digital</h2>
        <div class="credential__card">
          <span class="credential__qr" aria-hidden="true"></span>
          <div><strong>${d.name}</strong><span>${d.credential}</span><span>${d.moto.model} · ${d.moto.plate}</span>${raw(pill('Regular', 'ok'))}</div>
        </div>
        <p class="fine">Exemplo ilustrativo. Na versão real, o QR code abriria uma página pública mostrando se o profissional está regular, para o passageiro conferir.</p>
      </section>`) : ''}
      <button class="btn btn--ghost btn--block" type="button" data-act="restart">${raw(icons.restart())}Refazer o cadastro do zero (reinicia a demonstração)</button>`;
  };

  const render = () => {
    const body = ui.tab === 'corridas' ? corridas() : ui.tab === 'historico' ? historico() : cadastro();
    el.innerHTML = html`${raw(head())}<div class="tab-panel" role="tabpanel">${raw(body)}</div>`;
    syncMap(true);
    tick();
  };
  const sched = makeScheduler(el, render);

  function syncMap(structural = false) {
    const d = me();
    const ride = w.activeRideOfDriver(d.id);
    const offer = !ride ? w.offersFor(d.id)[0] : null;

    mm.setDrivers(d.reg === 'aprovado' && (d.online || d.rideId) ? [w.driverView(d, { name: 'Você', selected: true })] : []);
    const shown = ride || offer;
    const key = `${shown?.id}|${shown?.state}`;
    if (ride) mm.setTrip({ ...w.tripView(ride), driverId: d.id });
    else if (offer && (structural || key !== tripKey)) {

      mm.setTrip({ origin: offer.origin, dest: offer.dest, plan: w.planPath(offer.origin, offer.dest), leg: [[d.lat, d.lng], ...w.planPath(d, offer.origin)], legKind: 'pickup', driverId: d.id });
    } else if (!shown && tripKey !== '') mm.setTrip({});
    if (key !== tripKey) {
      tripKey = shown ? key : '';
      if (shown) mm.fit(mm.bounds([shown.origin, shown.dest, d]));
    }
  }

  function tick() {
    const d = me();
    const ride = w.activeRideOfDriver(d.id);
    if (d.reg !== 'aprovado') { float.setStatus(`Cadastro: ${d.reg.replace('_', ' ')}.`); return; }
    if (ride) {
      const toPickup = ride.state === 'a_caminho' ? w.distanceTo(d, ride.origin) : 0;
      const rem = ride.state === 'em_corrida' ? w.distanceTo(d, ride.dest) : ride.distanceM;
      const line = ride.state === 'a_caminho' ? `Chegue ao passageiro em ${minutes(toPickup / d.speed)}` : ride.state === 'no_local' ? 'Você chegou ao embarque' : ride.atDest ? 'Você chegou ao destino' : `Destino em ${minutes(rem / d.speed)}`;
      const sub = ride.state === 'a_caminho' ? `${formatDistance(toPickup)} até o embarque` : ride.state === 'no_local' ? 'Confira o nome do passageiro e inicie a corrida.' : ride.atDest ? 'Finalize a corrida.' : `${formatDistance(rem)} restantes`;
      bindText(el, { 'd-line': line, 'd-sub': sub });
      const bar = el.querySelector('[data-progress]');
      if (bar && ride.state === 'em_corrida') { const pct = Math.round((1 - rem / Math.max(1, ride.distanceM)) * 100); bar.style.width = `${pct}%`; bar.parentElement.setAttribute('aria-valuenow', String(pct)); }
      float.setStatus(`${ride.id}: ${line.toLowerCase()}`);
      return;
    }
    const offers = w.offersFor(d.id);
    if (offers.length) {
      offers.forEach((r) => {
        const o = r.offers[d.id];
        const left = Math.max(0, o.expiresT - w.t);
        bindText(el, { [`offer-${r.id}`]: String(Math.ceil(left)) });
        const ring = el.querySelector(`[data-offer="${r.id}"]`);
        if (ring) ring.style.setProperty('--p', String(Math.round((left / (o.expiresT - o.sentT)) * 100)));
      });
      float.setStatus(`Novo pedido: ${money(offers[0].fare)}`);
    } else float.setStatus(d.online ? 'Disponível, aguardando pedidos.' : 'Offline.');
  }

  const offs = [
    w.on('tick', () => { syncMap(); tick(); }),
    w.on('change', ({ topic, id }) => {
      if (topic === 'ride') {
        const r = w.ride(id);
        if (r?.state === 'ofertada' && r.offers[w.userDriverId]?.state === 'pendente' && !ui.seenOffers.has(r.id)) {
          ui.seenOffers.add(r.id);
          ctx.announce('Novo pedido de corrida.');
          if (ui.tab === 'corridas' && !desktop()) ctx.sheet.set('full');
        }
        if (r?.driverId === w.userDriverId && ui.lastState[r.id] !== r.state) {
          ui.lastState[r.id] = r.state;
          ui.giveUp = false;
          ui.pinError = false;
          if (!desktop() && r.state === 'a_caminho') ctx.sheet.set('collapsed');
          if (!desktop() && ['no_local', 'concluida'].includes(r.state)) ctx.sheet.set('full');
        }
      }
      if (['ride', 'drivers', 'occurrences', 'reset'].includes(topic)) sched.schedule();
    })
  ];

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.type === 'checkbox') return;
    const act = b.dataset.act;
    const d = me();
    if (act === 'tab') { ui.tab = b.dataset.tab; sched.now(); }
    else if (act === 'accept') {
      const r = w.acceptRide(b.dataset.id, d.id);
      if (!r) ctx.announce('Esse pedido não está mais disponível.');
      sched.now();
    }
    else if (act === 'decline') { w.declineOffer(b.dataset.id, d.id); sched.now(); }
    else if (act === 'pstar') { ui.pRating = Number(b.dataset.v); sched.now(); }
    else if (act === 'prate') { w.rateRidePassenger(b.dataset.id, ui.pRating); ui.pRating = 0; sched.now(); }
    else if (act === 'pskip') { ui.pDismissed.add(b.dataset.id); ui.pRating = 0; sched.now(); }
    else if (act === 'finish') { w.finishRide(b.dataset.id); sched.now(); }
    else if (act === 'giveup-toggle') { ui.giveUp = !ui.giveUp; sched.now(); }
    else if (act === 'doc') { w.driverSaveProfile(d.id, { name: ui.profile.name, phone: ui.profile.phone, moto: { model: ui.profile.model, color: ui.profile.color, plate: ui.profile.plate } }); w.driverSendDoc(d.id, b.dataset.id); sched.now(); }
    else if (act === 'submit') {
      w.driverSaveProfile(d.id, { name: ui.profile.name, phone: ui.profile.phone, moto: { model: ui.profile.model, color: ui.profile.color, plate: ui.profile.plate } });
      w.driverSubmit(d.id);
      ui.tab = 'corridas';
      sched.now();
    }
    else if (act === 'restart') { onRestart(); }
  };

  const onChange = (e) => {
    const c = e.target.closest('input[data-act="online"]');
    if (c) { w.setOnline(me().id, c.checked); sched.now(); }
  };

  const onInput = (e) => {
    const f = e.target.closest('form[data-form="profile"]');
    if (!f || !(e.target.name in ui.profile)) return;
    ui.profile[e.target.name] = e.target.value;
    const submit = el.querySelector('[data-act="submit"]');
    if (submit) submit.disabled = !(profileComplete() && docsComplete());
  };

  const onSubmit = (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === 'start') {
      ui.pinError = w.startRide(form.dataset.id, String(data.get('pin')).trim()) !== true;
      sched.now();
    } else if (form.dataset.form === 'giveup') {
      const r = w.activeRideOfDriver(me().id);
      if (r) w.cancelRide(r.id, 'mototaxista', String(data.get('reason')));
      ui.giveUp = false;
      sched.now();
    } else if (form.dataset.form === 'occ') {
      const r = w.activeRideOfDriver(me().id) || w.ridesOfDriver(me().id)[0];
      const occ = w.openOccurrence({ by: 'mototaxista', rideId: r?.id || null, type: String(data.get('type')), text: String(data.get('text')) });
      ui.lastOcc = occ.id;
      sched.now();
    }
  };

  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('input', onInput);
  el.addEventListener('submit', onSubmit);
  mm.onDriver(() => {});
  mm.fit();
  render();

  return function unmount() {
    offs.forEach((f) => f());
    sched.destroy();
    keeper.destroy();
    el.removeEventListener('click', onClick);
    el.removeEventListener('change', onChange);
    el.removeEventListener('input', onInput);
    el.removeEventListener('submit', onSubmit);
  };
}

export function resetDriverUi() { ui.profile = null; ui.tab = 'cadastro'; ui.giveUp = false; ui.pinError = false; ui.pRating = 0; ui.pDismissed.clear(); ui.seenOffers.clear(); ui.lastState = {}; }
