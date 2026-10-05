// Tela do passageiro: cadastro rápido, pedido de corrida, acompanhamento, avaliação, histórico e ajuda.
import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href } from '../router.js';
import { PLACES, placeAt } from '../../data/mock/mototaxi/corridor.js';
import { secToHHMM } from '../../lib/time.js';
import {
  simBadge, money, km, minutes, routeText, ridePill, pill, driverCard, timelineList, formatDistance,
  makeScheduler, bindText, field
} from './common.js';

const OCC_TYPES = ['Conduta do mototaxista', 'Segurança', 'Cobrança acima da tabela', 'Acidente', 'Outro'];

// O estado da tela fica fora do mount: sair para outra aba e voltar não apaga o que a pessoa escolheu.
const ui = {
  tab: 'pedir', origin: PLACES[0], dest: PLACES[PLACES.length - 1], customs: [], picking: null,
  step: 1, draft: { name: '', phone: '' }, rating: 0, shareOpen: false, dismissed: new Set(), occRide: '', lastOcc: null, lastState: {}
};

const placeOptions = () => [...PLACES, ...ui.customs];
const optionsHtml = (selectedId) => placeOptions().map((p) => html`<option value="${p.id}" ${p.id === selectedId ? raw('selected') : ''}>${p.name}</option>`);

function rideLive(w, ride) {
  const d = w.driver(ride.driverId);
  if (!d) return { line: '', sub: '', pct: 0 };
  if (ride.state === 'a_caminho') {
    const dist = Math.abs(d.along - ride.origin.along);
    return { line: `Chega em ${minutes(dist / d.speed)}`, sub: `${formatDistance(dist)} até o embarque`, pct: 0 };
  }
  if (ride.state === 'no_local') return { line: 'Mototaxista no local', sub: `Confira a placa ${d.moto.plate} antes de embarcar`, pct: 0 };
  if (ride.atDest) return { line: 'Você chegou ao destino', sub: 'Aguardando o mototaxista encerrar a corrida', pct: 100 };
  const rem = Math.abs(d.along - ride.dest.along);
  return { line: `Destino em ${minutes(rem / d.speed)}`, sub: `${formatDistance(rem)} restantes`, pct: Math.round((1 - rem / Math.max(1, ride.distanceM)) * 100) };
}

export function mountPassenger(el, scope) {
  const { w, mm, float, ctx } = scope;
  const desktop = () => window.matchMedia('(min-width: 1024px)').matches;
  let lastTrip = 0;
  let tripKey = '';

  // ---------- Telas ----------

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

  const planner = () => {
    const q = w.quote(ui.origin, ui.dest);
    const near = w.eligibleDrivers(ui.origin.along, w.rules.despacho.raioInicialM).slice(0, 4);
    return html`
      <section class="card">
        <h2 class="card-title">${raw(icons.pin())}Para onde você vai?</h2>
        <div class="form">
          <div class="field">
            <label class="field__label" for="m-origin">Embarque</label>
            <div class="field__row">
              <select id="m-origin" data-act="origin" data-keep="origin">${optionsHtml(ui.origin.id)}</select>
              <button type="button" class="btn btn--secondary" data-act="pick" data-kind="origin" aria-pressed="${ui.picking === 'origin'}">${ui.picking === 'origin' ? 'Toque no mapa' : 'No mapa'}</button>
            </div>
          </div>
          <button type="button" class="swap" data-act="swap" aria-label="Trocar embarque e destino">${raw(icons.swap())}</button>
          <div class="field">
            <label class="field__label" for="m-dest">Destino</label>
            <div class="field__row">
              <select id="m-dest" data-act="dest" data-keep="dest">${optionsHtml(ui.dest.id)}</select>
              <button type="button" class="btn btn--secondary" data-act="pick" data-kind="dest" aria-pressed="${ui.picking === 'dest'}">${ui.picking === 'dest' ? 'Toque no mapa' : 'No mapa'}</button>
            </div>
          </div>
          ${ui.picking ? raw(html`<p class="note note--warn" role="note">${raw(icons.info())}<span>Toque no mapa, perto do trajeto tracejado, para escolher o ${ui.picking === 'origin' ? 'embarque' : 'destino'}. O ponto é ajustado para a via mais próxima.</span></p>`) : ''}
        </div>
      </section>

      <section class="card quote" aria-live="polite">
        ${q.valid ? raw(html`
          <dl class="quote__grid">
            <div><dt>Distância</dt><dd>${km(q.distanceM)}</dd></div>
            <div><dt>Tempo estimado</dt><dd>${minutes(q.durationSec)}</dd></div>
            <div class="quote__fare"><dt>Valor pela tabela</dt><dd>${money(q.fare)}</dd></div>
          </dl>
          <p class="fine">Pagamento direto ao mototaxista, em dinheiro ou Pix. Os valores da tabela são fictícios nesta demonstração: quem define é a Secretaria.</p>`) : raw(html`<p class="muted">Escolha um embarque e um destino diferentes (pelo menos 200 m de distância).</p>`)}
      </section>

      <section class="card">
        <h2 class="card-title">${raw(icons.moto())}Mototaxistas disponíveis perto do embarque</h2>
        ${near.length ? raw(html`<ul class="people">${near.map((d) => html`
          <li>${raw(driverCard(w, d, html`<button class="btn btn--secondary btn--sm" type="button" data-act="call" data-id="${d.id}" ${q.valid ? '' : raw('disabled')}>Chamar</button>`))}
          <span class="person__eta">a ${formatDistance(Math.abs(d.along - ui.origin.along))}, cerca de ${minutes(Math.abs(d.along - ui.origin.along) / d.speed)}</span></li>`)}</ul>`)
          : raw(html`<p class="empty">Nenhum mototaxista disponível perto deste ponto agora. Você pode pedir assim mesmo: a busca é ampliada.</p>`)}
      </section>

      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="request" ${q.valid ? '' : raw('disabled')}>${raw(icons.moto())}Pedir mototáxi</button>`;
  };

  const rideCard = (ride) => {
    const d = w.driver(ride.driverId);
    const live = rideLive(w, ride);
    const searching = ride.state === 'ofertada';
    return html`
      <section class="card ride">
        <div class="card-head">
          <h2 class="card-title">Corrida ${ride.id}</h2>
          ${raw(ridePill(ride.state))}
        </div>
        <p class="ride__route">${raw(routeText(ride))}</p>
        ${searching ? raw(html`
          <div class="ride__status">
            <span class="spinner" aria-hidden="true"></span>
            <div>
              <strong>Procurando o mototaxista mais próximo</strong>
              <span>${ride.currentOffer ? raw(html`Oferta ${ride.queueIdx} de ${ride.queue.length}${ride.round === 2 ? ' (busca ampliada)' : ''}. Aguardando resposta: <span data-bind="countdown"></span>`) : ride.queue.length ? 'Buscando o próximo mototaxista' : 'Ninguém por perto. Ampliando a busca'}</span>
            </div>
          </div>`) : raw(html`
          <div class="ride__status ride__status--live">
            <div>
              <strong data-bind="live-line">${live.line}</strong>
              <span data-bind="live-sub">${live.sub}</span>
            </div>
          </div>
          ${ride.state === 'em_corrida' ? raw(html`<div class="progress" role="progressbar" aria-label="Progresso da corrida" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${live.pct}"><span class="progress__bar" data-progress style="width:${live.pct}%"></span></div>`) : ''}
          ${raw(driverCard(w, d))}
          ${['a_caminho', 'no_local'].includes(ride.state) ? raw(html`
            <div class="pin">
              <span class="field__label">Código de embarque</span>
              <strong class="pin__code" aria-label="Código ${ride.pin.split('').join(' ')}">${ride.pin}</strong>
              <span class="fine">Informe este código ao mototaxista para iniciar a corrida. Assim você confirma que está na moto certa.</span>
            </div>`) : ''}`)}
        <dl class="facts facts--2">
          <div><dt>Distância</dt><dd>${km(ride.distanceM)}</dd></div>
          <div><dt>Valor pela tabela</dt><dd>${money(ride.fare)}</dd></div>
        </dl>
        <div class="actions">
          ${ride.state !== 'em_corrida' ? raw(html`<button class="btn btn--secondary" type="button" data-act="cancel">Cancelar corrida</button>`) : ''}
          <button class="btn btn--ghost" type="button" data-act="share" aria-expanded="${ui.shareOpen}">${raw(icons.external())}Compartilhar trajeto</button>
          <button class="btn btn--ghost" type="button" data-act="occ-ride" data-id="${ride.id}">${raw(icons.alert())}Registrar ocorrência</button>
        </div>
        ${ui.shareOpen ? raw(html`<div class="note" role="note">${raw(icons.info())}<div><p>Exemplo de link para uma pessoa de confiança: <strong>amarelinho.exksvol.com/#/mototaxi/${ride.id}</strong></p><p class="fine">Na versão real, quem recebesse o link acompanharia a moto no mapa até o fim da corrida.</p></div></div>`) : ''}
      </section>
      <section class="card">
        <h2 class="card-title">${raw(icons.clock())}O que aconteceu</h2>
        ${raw(timelineList(ride.events))}
      </section>`;
  };

  const finished = (ride) => {
    if (ride.state === 'concluida') {
      return html`
        <section class="card ride">
          <div class="card-head"><h2 class="card-title">Corrida concluída</h2>${raw(ridePill('concluida'))}</div>
          <p class="ride__route">${raw(routeText(ride))}</p>
          <dl class="facts facts--2">
            <div><dt>Distância</dt><dd>${km(ride.distanceM)}</dd></div>
            <div><dt>Valor pela tabela</dt><dd>${money(ride.fare)}</dd></div>
          </dl>
          <p class="fine">Pague direto ao mototaxista. Se o valor cobrado for diferente da tabela, registre uma ocorrência.</p>
          ${ride.rating ? raw(html`<p class="ride__thanks">${raw(icons.check())}Obrigado pela avaliação: ${ride.rating} de 5.</p>`) : raw(html`
            <div class="rate">
              <p class="field__label" id="rate-label">Como foi a corrida com ${w.driver(ride.driverId).name}?</p>
              <div class="rate__stars" role="group" aria-labelledby="rate-label">
                ${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-act="star" data-v="${n}" aria-pressed="${ui.rating === n}" aria-label="${n} de 5" class="${ui.rating >= n ? 'is-on' : ''}">${raw(icons.star('star-ico'))}</button>`)}
              </div>
              <textarea name="comment" rows="2" placeholder="Comentário (opcional)" data-keep="comment" aria-label="Comentário sobre a corrida"></textarea>
              <button class="btn btn--primary btn--block" type="button" data-act="rate-send" ${ui.rating ? '' : raw('disabled')}>Enviar avaliação</button>
            </div>`)}
          <div class="actions">
            <button class="btn btn--secondary" type="button" data-act="occ-ride" data-id="${ride.id}">${raw(icons.alert())}Registrar ocorrência</button>
            <button class="btn btn--primary" type="button" data-act="dismiss" data-id="${ride.id}">Nova corrida</button>
          </div>
        </section>
        <section class="card"><h2 class="card-title">${raw(icons.clock())}O que aconteceu</h2>${raw(timelineList(ride.events))}</section>`;
    }
    const sem = ride.state === 'sem_aceite';
    return html`
      <section class="card ride">
        <div class="card-head"><h2 class="card-title">${sem ? 'Ninguém aceitou' : 'Corrida cancelada'}</h2>${raw(ridePill(ride.state))}</div>
        <p class="ride__route">${raw(routeText(ride))}</p>
        <p>${sem ? 'Nenhum mototaxista disponível aceitou o pedido. Tente de novo em instantes, ou escolha um profissional específico na lista de disponíveis.' : 'O pedido foi cancelado.'}</p>
        <div class="actions"><button class="btn btn--primary" type="button" data-act="dismiss" data-id="${ride.id}">${sem ? 'Tentar de novo' : 'Fazer novo pedido'}</button></div>
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
        <p class="fine">Botão de emergência: depende de um protocolo com quem vai atender (a definir com a Secretaria).</p>
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

  // ---------- Desenho ----------

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

  // ---------- Mapa e andamento ----------

  function syncMap(structural = false) {
    const active = w.passenger.registered && ui.tab === 'pedir' ? w.activeRideOfPassenger() : null;
    if (active) {
      const d = w.driver(active.driverId);
      // Procurando: as motos ao redor aparecem e a que está recebendo a oferta fica em destaque.
      const around = active.state === 'ofertada'
        ? w.eligibleDrivers(active.origin.along, 1e9).map((x) => ({ id: x.id, name: x.name, status: 'disponivel', along: x.along, selected: x.id === active.currentOffer }))
        : [];
      mm.setDrivers(d ? [{ id: d.id, name: d.name, status: w.statusOf(d), along: d.along, selected: true }] : around);
      const key = `${active.id}|${active.state}`;
      if (structural || key !== tripKey || performance.now() - lastTrip > 900) {
        mm.setTrip({
          origin: active.origin, dest: active.dest, driverAlong: d?.along, showPickup: active.state === 'a_caminho',
          progressAlong: active.state === 'em_corrida' && d ? d.along : null
        });
        lastTrip = performance.now();
      }
      if (key !== tripKey) {
        tripKey = key;
        const pts = mm.bounds([active.origin, active.dest, ...(d ? [{ along: d.along }] : [])]);
        mm.fit(pts);
      }
    } else {
      const showPlan = w.passenger.registered && ui.tab === 'pedir';
      mm.setDrivers(showPlan ? w.eligibleDrivers(ui.origin.along, 1e9).map((d) => ({ id: d.id, name: d.name, status: 'disponivel', along: d.along })) : []);
      if (showPlan) mm.setTrip({ origin: ui.origin, dest: ui.dest });
      else mm.setTrip({});
      tripKey = '';
    }
  }

  function tick() {
    const active = w.activeRideOfPassenger();
    if (!active) { float.setStatus(w.passenger.registered ? 'Pronto para pedir uma corrida.' : 'Faça o cadastro rápido para pedir.'); return; }
    if (active.state === 'ofertada') {
      const o = active.currentOffer && active.offers[active.currentOffer];
      const left = o ? Math.max(0, Math.ceil(o.expiresT - w.t)) : 0;
      bindText(el, { countdown: `${left} s` });
      float.setStatus(`${active.id}: procurando mototaxista${o ? ` (oferta ${active.queueIdx} de ${active.queue.length}, ${left} s)` : ''}`);
      return;
    }
    const live = rideLive(w, active);
    bindText(el, { 'live-line': live.line, 'live-sub': live.sub });
    const bar = el.querySelector('[data-progress]');
    if (bar) { bar.style.width = `${live.pct}%`; bar.parentElement.setAttribute('aria-valuenow', String(live.pct)); }
    float.setStatus(`${active.id}: ${live.line.toLowerCase()}`);
  }

  // ---------- Eventos ----------

  const offs = [
    w.on('tick', () => { syncMap(); tick(); }),
    w.on('change', ({ topic, id }) => {
      if (topic === 'ride') {
        const r = w.ride(id);
        if (r?.passenger.isUser) handleRideChange(r);
      }
      if (['ride', 'drivers', 'occurrences', 'reset', 'passenger'].includes(topic)) sched.schedule();
    })
  ];

  /** No celular, o mapa precisa aparecer quando a moto aceita; o painel volta ao final da corrida. */
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
    else if (act === 'swap') { [ui.origin, ui.dest] = [ui.dest, ui.origin]; rerender(); }
    else if (act === 'pick') {
      ui.picking = ui.picking === b.dataset.kind ? null : b.dataset.kind;
      mm.pickMode(ui.picking ? ({ along }) => {
        const place = placeAt(along);
        if (!PLACES.some((p) => p.id === place.id) && !ui.customs.some((p) => p.id === place.id)) ui.customs.push(place);
        if (ui.picking === 'origin') ui.origin = place; else ui.dest = place;
        ui.picking = null;
        mm.pickMode(null);
        rerender();
      } : null);
      if (ui.picking && !desktop()) ctx.sheet.set('collapsed');
      rerender();
    }
    else if (act === 'call') { const r = w.requestRide({ origin: ui.origin, dest: ui.dest, preferredDriverId: b.dataset.id }); if (r) ui.shareOpen = false; rerender(); }
    else if (act === 'request') { w.requestRide({ origin: ui.origin, dest: ui.dest }); ui.shareOpen = false; rerender(); }
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
    if (s.dataset.act === 'origin') ui.origin = place; else ui.dest = place;
    rerender();
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

  return function unmount() {
    offs.forEach((f) => f());
    sched.destroy();
    el.removeEventListener('click', onClick);
    el.removeEventListener('change', onChange);
    el.removeEventListener('submit', onSubmit);
    mm.pickMode(null);
    ui.picking = null;
  };
}

/** Depois de reiniciar o mundo simulado, a tela recomeça do zero. */
export function resetPassengerUi() {
  Object.assign(ui, { tab: 'pedir', origin: PLACES[0], dest: PLACES[PLACES.length - 1], customs: [], picking: null, step: 1, draft: { name: '', phone: '' }, rating: 0, shareOpen: false, occRide: '', lastOcc: null });
  ui.dismissed.clear();
  ui.lastState = {};
}
