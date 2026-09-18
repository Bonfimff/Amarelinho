import { html } from '../../lib/text.js';
import { lineCard } from '../components.js';
import { operationStatus } from '../../lib/time.js';

export default {
  title: 'Linhas',

  mount(el, ctx) {
    const { lines, map } = ctx;
    map.showOverview();
    let filter = 'todas';
    const render = () => {
      const list = lines.filter((l) => filter === 'todas' || (filter === 'operacao' ? operationStatus(l.operatingHours).open : l.hasLiveData));
      el.querySelector('[data-list]').innerHTML = list.length ? html`${list.map((l) => lineCard(l))}` : '<p class="empty">Nenhuma linha neste filtro.</p>';
      el.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    };
    el.innerHTML = html`
      <header class="view-head">
        <p class="ribbon">Amarelinhos · Tarifa Zero</p>
        <h1>Linhas</h1>
        <p class="muted">${lines.length} linhas gratuitas do transporte público municipal.</p>
      </header>
      <div class="segmented" role="group" aria-label="Filtrar linhas">
        <button type="button" data-filter="todas">Todas</button>
        <button type="button" data-filter="operacao">No horário agora</button>
        <button type="button" data-filter="aovivo">Ônibus no mapa</button>
      </div>
      <div class="line-grid" data-list></div>
    `;
    el.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
    render();
  }
};
