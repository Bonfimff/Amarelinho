import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href, navigate } from '../router.js';
import { MotoMap } from '../moto/motoMap.js';
import { MotoFloat, world, simBadge } from '../moto/common.js';
import { mountPassenger, resetPassengerUi } from '../moto/passenger.js';
import { mountDriver, resetDriverUi } from '../moto/driver.js';
import { mountAdmin } from '../moto/admin.js';

let autoStarted = false;

const ROLES = [
  { key: 'passageiro', icon: 'user', title: 'Passageiro', text: 'Cadastro rápido, pedido de corrida, acompanhamento da moto, avaliação e ocorrências.' },
  { key: 'mototaxista', icon: 'moto', title: 'Mototaxista', text: 'Cadastro com documentos, disponibilidade, pedidos, corrida, histórico e ganhos.' },
  { key: 'secretaria', icon: 'shield', title: 'Secretaria', text: 'Aprovação de cadastros, corridas, ocorrências, regras e tarifas, relatórios e auditoria.' }
];

function hub(el, scope) {
  const { w, mm, float } = scope;
  el.innerHTML = html`
    <header class="view-head">
      <p class="ribbon">Plataforma de mobilidade · Magé</p>
      <h1>Mototáxi</h1>
      <p class="muted">${raw(simBadge('Simulação'))} Área de demonstração de como o serviço poderia funcionar.</p>
    </header>
    <div class="note note--warn" role="note">${raw(icons.info())}<div>
      <strong>Tudo aqui é fictício.</strong>
      <p>Profissionais, passageiros, valores e regras são exemplos e não representam o serviço, as regras nem os profissionais de nenhum município. As motos andam sobre o traçado da linha TZ01 (Piabetá a Magé), a única com via calculada neste protótipo.</p>
    </div></div>
    <ul class="roles">${ROLES.map((r) => html`
      <li><a class="role-card" href="${href(`/mototaxi/${r.key}`)}">
        <span class="role-card__icon">${raw(icons[r.icon]())}</span>
        <span class="role-card__body"><strong>${r.title}</strong><span>${r.text}</span></span>
        <span class="role-card__chev">${raw(icons.chevronRight())}</span>
      </a></li>`)}</ul>
    <section class="card">
      <h2 class="card-title">${raw(icons.play())}Para demonstrar em um minuto</h2>
      <ol class="plain-list plain-list--num">
        <li>Em <strong>Passageiro</strong>, cadastre-se (o código é 123456) e peça uma corrida.</li>
        <li>Acompanhe a moto no mapa até a conclusão e avalie. A simulação roda em 5x; mude no cartão do mapa.</li>
        <li>Em <strong>Mototaxista</strong>, fique disponível e aceite os pedidos que chegarem. Como nos aplicativos de transporte, cada pedido é oferecido a um profissional por vez, do mais próximo ao mais distante.</li>
        <li>Em <strong>Secretaria</strong>, veja a corrida, aprove cadastros e mude as regras.</li>
      </ol>
    </section>
    <section class="card">
      <h2 class="card-title">${raw(icons.restart())}Recomeçar</h2>
      <div class="actions">
        <button class="btn btn--secondary" type="button" data-act="reset">Reiniciar demonstração</button>
        <button class="btn btn--secondary" type="button" data-act="reset-scratch">Reiniciar sem o cadastro do mototaxista</button>
      </div>
      <p class="fine">A segunda opção deixa você passar pelo credenciamento completo: enviar documentos como mototaxista e aprovar como Secretaria.</p>
    </section>`;

  const draw = () => {
    mm.setDrivers([...w.drivers.values()].filter((d) => d.reg === 'aprovado' && (d.online || d.rideId)).map((d) => ({ id: d.id, name: d.name, status: w.statusOf(d), along: d.along, selected: false })));
    const s = w.stats();
    float.setStatus(`${s.online} profissionais online · ${s.active} ${s.active === 1 ? 'corrida' : 'corridas'} em andamento`);
  };
  const off = w.on('tick', draw);
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    w.reset({ driverFromScratch: b.dataset.act === 'reset-scratch' });
    resetPassengerUi();
    resetDriverUi();
    navigate('/mototaxi', null, { replace: true });
  };
  el.addEventListener('click', onClick);
  mm.fit();
  draw();
  return () => { off(); el.removeEventListener('click', onClick); };
}

export default {
  title: 'Mototáxi',

  mount(el, ctx) {
    const w = world();
    ctx.map.showOverview();
    const mm = new MotoMap(ctx.map);
    const float = new MotoFloat(document.querySelector('.map-pane'), w);
    const scope = { w, mm, float, ctx };

    if (!autoStarted) { autoStarted = true; w.start(); }

    const role = ctx.params.papel;
    const restart = () => {
      w.reset({ driverFromScratch: true });
      resetPassengerUi();
      resetDriverUi();
      navigate('/mototaxi/mototaxista', null, { replace: true });
    };
    let stop;
    if (role === 'passageiro') stop = mountPassenger(el, scope);
    else if (role === 'mototaxista') stop = mountDriver(el, scope, { onRestart: restart });
    else if (role === 'secretaria') stop = mountAdmin(el, scope);
    else stop = hub(el, scope);

    this.cleanup = () => { stop?.(); mm.destroy(); float.destroy(); };
  },

  unmount() { this.cleanup?.(); this.cleanup = null; }
};
