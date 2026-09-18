import { html, raw, normalize } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href, navigate } from '../router.js';
import { lineCard, lineChip } from '../components.js';

async function runSearch(query, { lines, transport }) {
  const q = normalize(query);
  if (!q) return { lines: [], stops: [] };
  const codeMatch = q.replace(/\s+/g, '').match(/^(?:tz)?0?(\d{1,2})$/);
  const code = codeMatch ? `TZ${codeMatch[1].padStart(2, '0')}` : null;

  const lineResults = [];
  for (const line of lines) {
    const fields = [
      ['nome', `${line.origin} x ${line.destination} ${line.variant || ''}`],
      ['detalhamento', `${line.published?.title || ''} ${line.published?.departure || ''} ${line.published?.arrival || ''}`]
    ];
    let matched = null;
    if (line.id === code || normalize(line.id).includes(q.replace(/\s+/g, ''))) matched = '';
    else if (normalize(fields[0][1]).includes(q)) matched = '';
    else if (normalize(fields[1][1]).includes(q)) matched = `Detalhamento publicado: ${line.published.title}`;
    else {
      const stop = [...(line.published?.stops || []), ...(line.published?.returnStops || [])].find((s) => normalize(s).includes(q));
      if (stop) matched = `Passa por: ${stop}`;
    }
    if (matched !== null) lineResults.push({ line, matched });
  }

  const byStop = new Map();
  for (const line of lines.filter((l) => l.hasShape)) {
    const stops = await transport.getStops(line.id, line.directions[0].id);
    stops.filter((s) => normalize(s.name).includes(q)).forEach((s) => {
      if (!byStop.has(s.id)) byStop.set(s.id, { stop: s, lines: [] });
      byStop.get(s.id).lines.push(line);
    });
  }
  const stopResults = [...byStop.values()];
  return { lines: lineResults, stops: stopResults };
}

export default {
  title: 'Buscar',

  mount(el, ctx) {
    const initial = ctx.query.q || '';
    el.innerHTML = html`
      <header class="view-head">
        <h1>Buscar</h1>
        <p class="muted">Procure por linha (ex.: TZ01), bairro, ponto de parada, origem ou destino.</p>
      </header>
      <form class="search" role="search" data-form>
        <label class="sr-only" for="search-q">Digite uma linha, ponto ou destino</label>
        <span class="search__icon">${raw(icons.search())}</span>
        <input id="search-q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Linha, ponto ou destino" value="${initial}" />
        <button class="btn btn--primary search__btn" type="submit">Buscar</button>
      </form>
      <div aria-live="polite" data-results></div>
    `;
    const input = el.querySelector('#search-q');
    const results = el.querySelector('[data-results]');
    let seq = 0;

    const render = async (value) => {
      const my = ++seq;
      if (!value.trim()) {
        results.innerHTML = html`<p class="empty">Experimente: ${['Piabetá', 'Magé', 'Suruí', 'Detran', 'TZ13'].map((s) => html`<a class="chip" href="${href('/buscar', { q: s })}">${s}</a>`)}</p>`;
        return;
      }
      const r = await runSearch(value, ctx);
      if (my !== seq) return;
      const total = r.lines.length + r.stops.length;
      results.innerHTML = html`
        <p class="result-count">${total ? `${r.lines.length} ${r.lines.length === 1 ? 'linha' : 'linhas'} e ${r.stops.length} ${r.stops.length === 1 ? 'ponto' : 'pontos'} para “${value}”` : `Nada encontrado para “${value}”.`}</p>
        ${r.stops.length ? raw(html`<h2 class="list-title">Pontos de parada</h2><ul class="stop-results">${r.stops.map(({ stop, lines: ls }) => html`
          <li><a class="stop-result" href="${href(`/linha/${ls[0].id}/ponto/${stop.id}`)}">
            <span class="stop-result__icon">${raw(icons.pin())}</span>
            <span class="stop-result__text"><strong>${stop.name}</strong><span class="stop-result__lines">${ls.map((l) => lineChip(l.id, 'line-chip--sm'))}</span></span>
            ${raw(icons.chevronRight())}
          </a></li>`)}</ul>`) : ''}
        ${r.lines.length ? raw(html`<h2 class="list-title">Linhas</h2><div class="line-grid">${r.lines.map(({ line, matched }) => lineCard(line, { matched }))}</div>`) : ''}
      `;
    };

    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(input.value), 160); });
    el.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      navigate('/buscar', { q: input.value.trim() }, { replace: true });
    });
    ctx.map.showOverview();
    render(initial);
    if (!initial && window.matchMedia('(min-width: 1024px)').matches) input.focus();
  }
};
