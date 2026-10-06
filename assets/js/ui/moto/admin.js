import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href } from '../router.js';
import { DOC_TYPES } from '../../data/mock/mototaxi/seed.js';
import { STAND_IDS, placeById } from '../../data/mock/mototaxi/places.js';
import { secToHHMM } from '../../lib/time.js';
import {
  simBadge, money, km, stars, routeText, ridePill, regPill, docPill, pill, timelineList, field,
  makeScheduler, openKeeper, DRIVER_STATUS, RIDE_STATES
} from './common.js';

const TABS = [['visao', 'Visão geral'], ['cadastros', 'Cadastros'], ['corridas', 'Corridas'], ['ocorrencias', 'Ocorrências'], ['regras', 'Regras'], ['relatorios', 'Relatórios'], ['auditoria', 'Auditoria']];
const REG_FILTERS = [['todos', 'Todos'], ['em_analise', 'Em análise'], ['pendencia', 'Pendência'], ['aprovado', 'Aprovados'], ['suspenso', 'Suspensos']];
const RIDE_FILTERS = [['todas', 'Todas'], ['andamento', 'Em andamento'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas'], ['sem_aceite', 'Sem aceite']];
const SUSPEND_REASONS = ['Documento vencido', 'Ocorrência confirmada', 'Cobrança acima da tabela', 'Outro motivo'];
const ACTIVE = ['ofertada', 'a_caminho', 'no_local', 'em_corrida'];

const ui = { tab: 'visao', regFilter: 'todos', rideFilter: 'todas', focusRide: null, rulesMsg: '' };

const dec = (n, d = 1) => (n == null ? 'sem dados' : n.toFixed(d).replace('.', ','));

export function mountAdmin(el, scope) {
  const { w, mm, float } = scope;
  const keeper = openKeeper(el);
  let shownTrip = false;

  const head = () => html`
    <header class="view-head">
      <a class="back" href="${href('/mototaxi')}">${raw(icons.arrowLeft())}Mototáxi</a>
      <p class="ribbon">Mototáxi · Secretaria</p>
      <h1>Painel da Secretaria</h1>
      <p class="muted">${raw(simBadge('Simulação'))} Perfil de demonstração: gestor. Dados fictícios.</p>
    </header>
    <div class="segmented segmented--scroll" role="tablist" aria-label="Seções do painel">
      ${TABS.map(([k, label]) => html`<button type="button" role="tab" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}" aria-pressed="${ui.tab === k}">${label}</button>`)}
    </div>`;

  const visao = () => {
    const s = w.stats();
    const active = w.rides.filter((r) => ACTIVE.includes(r.state));
    const drivers = [...w.drivers.values()].filter((d) => d.reg === 'aprovado');
    const alerts = [];
    if (s.pendingRegs) alerts.push(html`<li><button type="button" class="linkbtn" data-act="goto" data-tab="cadastros" data-filter="em_analise">${s.pendingRegs} ${s.pendingRegs === 1 ? 'cadastro aguarda' : 'cadastros aguardam'} análise</button></li>`);
    if (s.openOccurrences) alerts.push(html`<li><button type="button" class="linkbtn" data-act="goto" data-tab="ocorrencias">${s.openOccurrences} ${s.openOccurrences === 1 ? 'ocorrência aberta' : 'ocorrências abertas'}</button></li>`);
    drivers.filter((d) => Object.values(d.docs).includes('vencido')).forEach((d) => {
      const doc = DOC_TYPES.find((x) => d.docs[x.id] === 'vencido');
      alerts.push(html`<li><button type="button" class="linkbtn" data-act="goto" data-tab="cadastros" data-driver="${d.id}">Documento vencido de ${d.name}: ${doc.label.toLowerCase()}</button></li>`);
    });
    if (s.noAccept) alerts.push(html`<li><button type="button" class="linkbtn" data-act="goto" data-tab="corridas" data-filter="sem_aceite">${s.noAccept} ${s.noAccept === 1 ? 'pedido ficou' : 'pedidos ficaram'} sem aceite hoje</button></li>`);
    return html`
      <div class="moto-kpis">
        <div class="kpi"><span class="kpi__value">${s.online}<small>/${s.approved}</small></span><span class="kpi__label">Profissionais online</span></div>
        <div class="kpi"><span class="kpi__value">${s.active}</span><span class="kpi__label">Corridas em andamento</span></div>
        <div class="kpi"><span class="kpi__value">${s.done}</span><span class="kpi__label">Concluídas hoje</span></div>
        <div class="kpi"><span class="kpi__value">${s.cancelled + s.noAccept}</span><span class="kpi__label">Canceladas ou sem aceite</span></div>
        <div class="kpi"><span class="kpi__value">${dec(s.avgRating)}</span><span class="kpi__label">Nota média</span></div>
        <div class="kpi"><span class="kpi__value">${s.avgAcceptSec == null ? '0' : Math.round(s.avgAcceptSec)} s</span><span class="kpi__label">Tempo médio até o aceite</span></div>
      </div>
      <section class="card">
        <h2 class="card-title">${raw(icons.alert())}Atenção</h2>
        ${alerts.length ? raw(html`<ul class="alerts">${alerts}</ul>`) : raw(html`<p class="empty">Nada pendente.</p>`)}
      </section>
      <section class="card">
        <h2 class="card-title">${raw(icons.route())}Corridas em andamento</h2>
        ${active.length ? raw(html`<ul class="cards">${active.map((r) => html`
          <li><button type="button" class="rowbtn ${ui.focusRide === r.id ? 'is-on' : ''}" data-act="focus-ride" data-id="${r.id}" aria-pressed="${ui.focusRide === r.id}">
            <span class="ridelog__top"><strong>${r.id}</strong> ${raw(ridePill(r.state))}</span>
            <span class="ridelog__route">${raw(routeText(r))}</span>
            <span class="ridelog__meta">${r.driverId ? w.driver(r.driverId).name : r.currentOffer ? `oferta ${r.queueIdx} de ${r.queue.length}, para ${w.driver(r.currentOffer).name}` : 'buscando mototaxista'} · ${km(r.distanceM)} · ${money(r.fare)}</span>
          </button></li>`)}</ul>`) : raw(html`<p class="empty">Nenhuma corrida no momento. Ative "Pedidos de outros passageiros" no cartão do mapa para ver movimento.</p>`)}
      </section>
      <section class="card">
        <h2 class="card-title">${raw(icons.moto())}Profissionais aprovados</h2>
        <ul class="cards">${drivers.map((d) => html`
          <li><button type="button" class="rowbtn" data-act="goto" data-tab="cadastros" data-driver="${d.id}">
            <span class="ridelog__top"><strong>${d.name}</strong> ${raw(pill(DRIVER_STATUS[w.statusOf(d)], d.rideId ? 'info' : d.online ? 'ok' : 'muted'))}</span>
            <span class="ridelog__meta">${d.credential} · ${d.moto.model} · ${stars(w.rating(d.id))}</span>
          </button></li>`)}</ul>
      </section>`;
  };

  const docsList = (d) => html`<ul class="docs">${DOC_TYPES.map((x) => html`<li><span class="docs__name">${x.label}</span>${raw(docPill(d.docs[x.id]))}</li>`)}</ul>`;

  const driverCard = (d) => {
    const key = `ad-${d.id}`;
    const busy = Boolean(d.rideId);
    const count = w.ridesOfDriver(d.id).filter((r) => r.state === 'concluida').length;
    return html`
      <li><details class="card ridelog" data-key="${key}" ${keeper.attr(key)} id="driver-${d.id}">
        <summary>
          <span class="ridelog__top"><strong>${d.name || 'Sem nome'}</strong> ${raw(regPill(d.reg))}</span>
          <span class="ridelog__route">${d.credential || 'Sem credencial'} · ${d.moto.model} · ${d.moto.plate}</span>
          <span class="ridelog__meta">${count} ${count === 1 ? 'corrida' : 'corridas'} · ${stars(w.rating(d.id))}</span>
        </summary>
        <dl class="facts facts--2"><div><dt>Celular</dt><dd>${d.phone}</dd></div><div><dt>Moto</dt><dd>${d.moto.model}, ${d.moto.color.toLowerCase()}</dd></div></dl>
        ${d.regNote ? raw(html`<p class="note note--warn" role="note">${raw(icons.info())}<span>${d.regNote}</span></p>`) : ''}
        ${raw(docsList(d))}
        <div class="actions">
          ${d.reg === 'em_analise' ? raw(html`<button class="btn btn--primary" type="button" data-act="approve" data-id="${d.id}">Aprovar cadastro</button>`) : ''}
          ${d.reg === 'suspenso' ? raw(html`<button class="btn btn--primary" type="button" data-act="reactivate" data-id="${d.id}">Reativar</button>`) : ''}
        </div>
        ${d.reg === 'em_analise' ? raw(html`
          <form class="form form--box" data-form="fix" data-id="${d.id}">
            <p class="field__label">Pedir correção</p>
            ${raw(field('Documento a corrigir', html`<select name="doc"><option value="">Nenhum em particular</option>${DOC_TYPES.map((x) => html`<option value="${x.id}">${x.label}</option>`)}</select>`))}
            ${raw(field('Mensagem ao profissional', html`<textarea name="note" rows="2" required></textarea>`))}
            <button class="btn btn--secondary btn--block" type="submit">Devolver com pendência</button>
          </form>`) : ''}
        ${d.reg === 'aprovado' ? raw(html`
          <form class="form form--box" data-form="suspend" data-id="${d.id}">
            <p class="field__label">Suspender</p>
            ${busy ? raw(html`<p class="fine">${d.name} está em corrida. Espere a corrida terminar para suspender.</p>`) : ''}
            ${raw(field('Motivo', html`<select name="reason">${SUSPEND_REASONS.map((r) => html`<option>${r}</option>`)}</select>`))}
            <button class="btn btn--secondary btn--block" type="submit" ${busy ? raw('disabled') : ''}>Suspender profissional</button>
          </form>`) : ''}
        ${['aprovado', 'suspenso', 'em_analise', 'pendencia'].includes(d.reg) ? raw(html`
          <form class="form form--box" data-form="cancelreg" data-id="${d.id}">
            <p class="field__label">Cancelar credenciamento</p>
            ${raw(field('Motivo', html`<input name="reason" type="text" required />`))}
            <button class="btn btn--ghost btn--block btn--danger" type="submit" ${busy ? raw('disabled') : ''}>Cancelar credenciamento</button>
          </form>`) : ''}
      </details></li>`;
  };

  const cadastros = () => {
    const all = [...w.drivers.values()].filter((d) => d.reg !== 'nao_cadastrado');
    const list = all.filter((d) => ui.regFilter === 'todos' || d.reg === ui.regFilter);
    return html`
      <div class="segmented segmented--scroll" role="group" aria-label="Filtrar cadastros">
        ${REG_FILTERS.map(([k, label]) => html`<button type="button" data-act="reg-filter" data-filter="${k}" aria-pressed="${ui.regFilter === k}">${label} (${k === 'todos' ? all.length : all.filter((d) => d.reg === k).length})</button>`)}
      </div>
      <p class="fine">A lista de documentos é um exemplo. A Secretaria define o que exigir, com base na legislação federal e municipal.</p>
      ${list.length ? raw(html`<ul class="cards">${list.map((d) => driverCard(d))}</ul>`) : raw(html`<p class="empty">Nenhum cadastro neste filtro.</p>`)}`;
  };

  const corridas = () => {
    const list = w.rides.slice().sort((a, b) => b.createdSim - a.createdSim).filter((r) => {
      if (ui.rideFilter === 'todas') return true;
      if (ui.rideFilter === 'andamento') return ACTIVE.includes(r.state);
      return r.state === ui.rideFilter;
    });
    return html`
      <div class="segmented segmented--scroll" role="group" aria-label="Filtrar corridas">
        ${RIDE_FILTERS.map(([k, label]) => html`<button type="button" data-act="ride-filter" data-filter="${k}" aria-pressed="${ui.rideFilter === k}">${label}</button>`)}
      </div>
      ${list.length ? raw(html`<ul class="cards">${list.map((r) => {
        const key = `ar-${r.id}`;
        const d = r.driverId && w.driver(r.driverId);
        return html`<li><details class="card ridelog" data-key="${key}" ${keeper.attr(key)}>
          <summary>
            <span class="ridelog__top"><strong>${r.id}</strong> ${raw(ridePill(r.state))}</span>
            <span class="ridelog__route">${raw(routeText(r))}</span>
            <span class="ridelog__meta">${secToHHMM(r.createdSim)} · ${d ? d.name : 'sem profissional'} · ${km(r.distanceM)} · ${money(r.fare)}</span>
          </summary>
          <dl class="facts facts--2">
            <div><dt>Passageiro</dt><dd>${r.passenger.name}</dd></div>
            <div><dt>Aceite em</dt><dd>${r.acceptSec == null ? 'sem dados' : `${Math.round(r.acceptSec)} s`}</dd></div>
            <div><dt>Nota</dt><dd>${r.rating ? `${r.rating} de 5` : 'sem nota'}</dd></div>
            <div><dt>Cancelamento</dt><dd>${r.cancelBy ? `${r.cancelBy}${r.late ? ' (fora do prazo)' : ''}` : 'sem cancelamento'}</dd></div>
          </dl>
          ${r.comment ? raw(html`<p class="fine">Comentário: ${r.comment}</p>`) : ''}
          ${raw(timelineList(r.events))}
        </details></li>`;
      })}</ul>`) : raw(html`<p class="empty">Nenhuma corrida neste filtro.</p>`)}`;
  };

  const ocorrencias = () => {
    const list = w.occurrences;
    return list.length ? html`<ul class="cards">${list.map((o) => {
      const key = `ao-${o.id}`;
      const d = o.driverId && w.driver(o.driverId);
      return html`<li><details class="card ridelog" data-key="${key}" ${keeper.attr(key)}>
        <summary>
          <span class="ridelog__top"><strong>${o.id}</strong> ${raw(pill(o.status === 'aberta' ? 'Aberta' : o.status === 'em_analise' ? 'Em análise' : 'Resolvida', o.status === 'resolvida' ? 'ok' : o.status === 'aberta' ? 'bad' : 'info'))}</span>
          <span class="ridelog__route">${o.type}</span>
          <span class="ridelog__meta">${secToHHMM(o.createdSim)} · aberta por ${o.by}${o.rideId ? ` · corrida ${o.rideId}` : ''}${d ? ` · ${d.name}` : ''}</span>
        </summary>
        <p>${o.text}</p>
        <form class="form form--box" data-form="occ" data-id="${o.id}">
          ${raw(field('Situação', html`<select name="status">${[['aberta', 'Aberta'], ['em_analise', 'Em análise'], ['resolvida', 'Resolvida']].map(([k, l]) => html`<option value="${k}" ${o.status === k ? raw('selected') : ''}>${l}</option>`)}</select>`))}
          ${raw(field('Resposta ao autor', html`<textarea name="reply" rows="2">${o.reply}</textarea>`))}
          <button class="btn btn--primary btn--block" type="submit">Salvar</button>
        </form>
        ${d ? raw(html`<button class="btn btn--ghost btn--block" type="button" data-act="goto" data-tab="cadastros" data-driver="${d.id}">Abrir cadastro de ${d.name}</button>`) : ''}
      </details></li>`;
    })}</ul>` : html`<p class="empty">Nenhuma ocorrência registrada.</p>`;
  };

  const regras = () => {
    const r = w.rules;
    const num = (name, label, value, hint, step = '0.5') => field(label, html`<input name="${name}" type="number" inputmode="decimal" min="0" step="${step}" value="${value}" required />`, hint);
    return html`
      <div class="note note--warn" role="note">${raw(icons.info())}<p><strong>Valores fictícios.</strong> A tabela de preços e as regras de despacho reais são definidas pela Secretaria. Aqui elas podem ser alteradas para ver o efeito na simulação.</p></div>
      <form class="card form" data-form="rules">
        <h2 class="card-title">Tabela de preços</h2>
        ${raw(num('tarifa.minimo', 'Valor mínimo (R$)', r.tarifa.minimo, 'Cobre os primeiros quilômetros.'))}
        ${raw(num('tarifa.kmIncluidos', 'Quilômetros incluídos no mínimo', r.tarifa.kmIncluidos, '', '0.5'))}
        ${raw(num('tarifa.porKmAdicional', 'Por quilômetro adicional (R$)', r.tarifa.porKmAdicional, ''))}
        <h2 class="card-title">Despacho dos pedidos</h2>
        ${raw(num('despacho.raioInicialM', 'Raio inicial de busca (metros)', r.despacho.raioInicialM, 'Distância máxima entre a moto e o passageiro na primeira rodada.', '100'))}
        ${raw(num('despacho.fatorAmpliacao', 'Fator de ampliação da busca', r.despacho.fatorAmpliacao, 'Se ninguém aceitar, o raio é multiplicado por este valor.', '0.1'))}
        ${raw(num('despacho.tempoAceiteSeg', 'Tempo para aceitar cada oferta (segundos)', r.despacho.tempoAceiteSeg, 'As ofertas saem uma a uma, do profissional que chega mais rápido ao mais distante. Sem resposta no tempo, a oferta passa para o próximo.', '5'))}
        ${raw(num('despacho.maxPorRodada', 'Profissionais consultados por rodada', r.despacho.maxPorRodada, 'Depois deles, a busca é ampliada uma vez.', '1'))}
        ${raw(num('despacho.cancelGratisSeg', 'Cancelamento sem custo até (segundos após o aceite)', r.despacho.cancelGratisSeg, '', '5'))}
        <button class="btn btn--primary btn--block" type="submit">Salvar regras</button>
        ${ui.rulesMsg ? raw(html`<p class="ride__thanks" role="status">${raw(icons.check())}${ui.rulesMsg}</p>`) : ''}
      </form>
      <section class="card">
        <h2 class="card-title">Efeito da tabela</h2>
        <ul class="plain-list plain-list--tight">${[1.5, 3, 5, 8, 12].map((d) => html`<li>${dec(d)} km: <strong>${money(w.fareFor(d * 1000))}</strong></li>`)}</ul>
      </section>
      <section class="card">
        <h2 class="card-title">${raw(icons.pin())}Pontos de demonstração</h2>
        <p class="fine">Locais fictícios onde os profissionais simulados costumam ficar. A Secretaria informa os pontos reais.</p>
        <ul class="plain-list plain-list--tight">${STAND_IDS.map((id) => html`<li>${placeById(id).name}</li>`)}</ul>
      </section>`;
  };

  const bars = (rows, max) => html`<ul class="bars">${rows.map(([label, n, cls = '']) => html`
    <li><span class="bars__label">${label}</span><span class="bars__track"><i class="${cls}" style="width:${max ? Math.max(n ? 3 : 0, Math.round((n / max) * 100)) : 0}%"></i></span><span class="bars__n">${n}</span></li>`)}</ul>`;

  const relatorios = () => {
    const s = w.stats();
    const byState = ['concluida', 'cancelada', 'sem_aceite', 'ofertada', 'a_caminho', 'no_local', 'em_corrida'].map((k) => [RIDE_STATES[k], w.rides.filter((r) => r.state === k).length, k === 'concluida' ? 'is-ok' : k === 'sem_aceite' ? 'is-bad' : k === 'cancelada' ? 'is-muted' : '']).filter((r) => r[1] > 0);
    const hours = new Map();
    w.rides.forEach((r) => { const h = Math.floor(r.createdSim / 3600) % 24; hours.set(h, (hours.get(h) || 0) + 1); });
    const hourRows = [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => [`${String(h).padStart(2, '0')}h`, n]);
    const perDriver = [...w.drivers.values()].filter((d) => d.reg === 'aprovado').map((d) => {
      const done = w.ridesOfDriver(d.id).filter((r) => r.state === 'concluida');
      return { d, n: done.length, km: done.reduce((a, r) => a + r.distanceM, 0) / 1000, rating: w.rating(d.id), accept: w.acceptRate(d.id), occ: w.occurrences.filter((o) => o.driverId === d.id).length };
    }).sort((a, b) => b.n - a.n);
    return html`
      <section class="card">
        <h2 class="card-title">Indicadores do dia</h2>
        <dl class="facts facts--2">
          <div><dt>Pedidos</dt><dd>${s.total}</dd></div>
          <div><dt>Distância das corridas</dt><dd>${dec(s.km)} km</dd></div>
          <div><dt>Até o aceite (médio)</dt><dd>${s.avgAcceptSec == null ? 'sem dados' : `${Math.round(s.avgAcceptSec)} s`}</dd></div>
          <div><dt>Até chegar ao passageiro</dt><dd>${s.avgPickupMin == null ? 'sem dados' : `${dec(s.avgPickupMin)} min`}</dd></div>
          <div><dt>Taxa de aceite das ofertas</dt><dd>${s.acceptRate == null ? 'sem dados' : `${Math.round(s.acceptRate * 100)}%`}</dd></div>
        </dl>
      </section>
      <section class="card"><h2 class="card-title">Pedidos por situação</h2>${raw(bars(byState, Math.max(1, ...byState.map((r) => r[1]))))}</section>
      <section class="card"><h2 class="card-title">Pedidos por horário</h2>${raw(bars(hourRows, Math.max(1, ...hourRows.map((r) => r[1]))))}</section>
      <section class="card">
        <h2 class="card-title">Por profissional</h2>
        <ul class="cards">${perDriver.map((p) => html`<li class="occ"><span class="ridelog__top"><strong>${p.d.name}</strong></span><span class="ridelog__meta">${p.n} ${p.n === 1 ? 'corrida' : 'corridas'} · ${dec(p.km)} km · nota ${dec(p.rating)} · aceite ${p.accept == null ? 'sem dados' : `${Math.round(p.accept * 100)}%`} · ${p.d.cancelled} ${p.d.cancelled === 1 ? 'desistência' : 'desistências'} · ${p.occ} ${p.occ === 1 ? 'ocorrência' : 'ocorrências'}</span></li>`)}</ul>
      </section>
      <button class="btn btn--secondary btn--block" type="button" data-act="csv">${raw(icons.download())}Baixar corridas (CSV)</button>`;
  };

  const auditoria = () => html`
    <p class="fine">Cada ação do painel fica registrada com quem fez e quando. Estes registros não podem ser apagados por quem usa o painel.</p>
    <ol class="audit">${w.audit.map((a) => html`<li><time>${secToHHMM(a.sim)}</time><div><strong>${a.action}</strong><span>${a.actor}: ${a.detail}</span></div></li>`)}</ol>`;

  const render = () => {
    const body = { visao, cadastros, corridas, ocorrencias, regras, relatorios, auditoria }[ui.tab]();
    el.innerHTML = html`${raw(head())}<div class="tab-panel" role="tabpanel">${raw(body)}</div>`;
    syncMap(true);
    tick();
  };
  const sched = makeScheduler(el, render);

  function syncMap(structural = false) {
    const ride = ui.focusRide && w.ride(ui.focusRide);
    const list = [...w.drivers.values()].filter((d) => d.reg === 'aprovado').map((d) => w.driverView(d, { selected: Boolean(ride && ride.driverId === d.id) }));
    mm.setDrivers(list);
    if (ride && ACTIVE.includes(ride.state)) mm.setTrip({ ...w.tripView(ride), driverId: ride.driverId });
    else if (structural || shownTrip) mm.setTrip({});
    shownTrip = Boolean(ride && ACTIVE.includes(ride.state));
  }

  function tick() {
    const s = w.stats();
    float.setStatus(`${s.online} online · ${s.active} ${s.active === 1 ? 'corrida' : 'corridas'} em andamento`);
  }

  const offs = [
    w.on('tick', () => { syncMap(); tick(); }),
    w.on('change', ({ topic }) => { if (topic !== 'clock') sched.schedule(); })
  ];

  mm.onDriver((id) => { ui.tab = 'cadastros'; ui.regFilter = 'todos'; keeper.add(`ad-${id}`); sched.now(); el.querySelector(`#driver-${id}`)?.scrollIntoView({ block: 'center' }); });

  const download = (name, text, type) => {
    const url = URL.createObjectURL(new Blob(['﻿', text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'tab') { ui.tab = b.dataset.tab; ui.rulesMsg = ''; sched.now(); }
    else if (act === 'goto') {
      ui.tab = b.dataset.tab;
      if (b.dataset.filter) { if (ui.tab === 'cadastros') ui.regFilter = b.dataset.filter; else ui.rideFilter = b.dataset.filter; }
      if (b.dataset.driver) { ui.regFilter = 'todos'; keeper.add(`ad-${b.dataset.driver}`); }
      sched.now();
      if (b.dataset.driver) el.querySelector(`#driver-${b.dataset.driver}`)?.scrollIntoView({ block: 'center' });
    }
    else if (act === 'reg-filter') { ui.regFilter = b.dataset.filter; sched.now(); }
    else if (act === 'ride-filter') { ui.rideFilter = b.dataset.filter; sched.now(); }
    else if (act === 'focus-ride') {
      ui.focusRide = ui.focusRide === b.dataset.id ? null : b.dataset.id;
      const r = w.ride(ui.focusRide);
      sched.now();
      if (r) { const d = r.driverId && w.driver(r.driverId); mm.fit(mm.bounds([r.origin, r.dest, d])); } else mm.fit();
    }
    else if (act === 'approve') { w.adminApprove(b.dataset.id); sched.now(); }
    else if (act === 'reactivate') { w.adminReactivate(b.dataset.id); sched.now(); }
    else if (act === 'csv') download('corridas-mototaxi-demonstracao.csv', w.ridesCsv(), 'text/csv;charset=utf-8');
  };

  const onSubmit = (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    const id = form.dataset.id;
    const kind = form.dataset.form;
    if (kind === 'fix') w.adminRequestFix(id, String(data.get('doc')) || null, String(data.get('note')));
    else if (kind === 'suspend') w.adminSuspend(id, String(data.get('reason')));
    else if (kind === 'cancelreg') w.adminCancelRegistration(id, String(data.get('reason')));
    else if (kind === 'occ') w.updateOccurrence(id, { status: String(data.get('status')), reply: String(data.get('reply')) });
    else if (kind === 'rules') {
      const patch = { tarifa: {}, despacho: {} };
      for (const [name, value] of data.entries()) { const [g, k] = name.split('.'); patch[g][k] = Number(String(value).replace(',', '.')); }
      const n = w.updateRules(patch);
      ui.rulesMsg = n ? `${n} ${n === 1 ? 'regra alterada' : 'regras alteradas'}. Vale para os próximos pedidos.` : 'Nenhuma alteração.';
    }
    sched.now();
  };

  el.addEventListener('click', onClick);
  el.addEventListener('submit', onSubmit);
  mm.fit();
  render();

  return function unmount() {
    offs.forEach((f) => f());
    sched.destroy();
    keeper.destroy();
    el.removeEventListener('click', onClick);
    el.removeEventListener('submit', onSubmit);
  };
}
