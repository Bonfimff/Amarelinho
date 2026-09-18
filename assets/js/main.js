import { transport, liveFeed } from './services/transportService.js';
import { analytics } from './services/analytics.js';
import { MapController } from './ui/map/mapController.js';
import { BottomSheet } from './ui/sheet.js';
import { parseLocation, navigate } from './ui/router.js';
import { skeletonCards } from './ui/components.js';
import { SimControls } from './ui/simControls.js';
import home from './ui/views/home.js';
import lines from './ui/views/lines.js';
import line from './ui/views/line.js';
import stop from './ui/views/stop.js';
import vehicle from './ui/views/vehicle.js';
import live from './ui/views/live.js';
import search from './ui/views/search.js';
import about from './ui/views/about.js';

const VIEWS = { home, lines, line, stop, vehicle, live, search, about };
const NAV_OF_VIEW = { home: 'home', lines: 'lines', line: 'lines', stop: 'lines', vehicle: 'live', live: 'live', search: 'search', about: 'about' };

const viewEl = document.getElementById('view');
const sheetEl = document.getElementById('sheet');
const liveRegion = document.getElementById('live-region');

const map = new MapController(document.getElementById('map'));
const sheet = new BottomSheet(sheetEl, { onChange: (px) => map.setBottomPadding(px) });
const sim = transport.clock ? new SimControls(document.querySelector('.map-pane'), transport.clock) : null;

const announce = (msg) => { liveRegion.textContent = ''; setTimeout(() => { liveRegion.textContent = msg; }, 50); };

let current = null;
let currentCtx = null;
let lineCache = [];

map.on('vehicle', (id) => navigate(`/veiculo/${id}`, { seguir: 1 }));
map.on('stop', (s) => {
  const { params, view } = parseLocation();
  const lineId = params.lineId || (view === 'vehicle' ? params.vehicleId.split('-')[0] : 'TZ01');
  navigate(`/linha/${lineId}/ponto/${s.id}`);
});

async function render() {
  const loc = parseLocation();
  const View = VIEWS[loc.view];
  if (current?.unmount) current.unmount(currentCtx);

  document.querySelectorAll('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === NAV_OF_VIEW[loc.view];
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  if (!View) {
    viewEl.innerHTML = '<p class="empty">Página não encontrada. <a href="#/">Voltar ao início</a></p>';
    analytics.tela('pagina_nao_encontrada', { rota: location.hash });
    current = null;
    return;
  }
  analytics.tela(loc.view, { params: loc.params, query: loc.query });

  current = View;
  map.on('follow', () => {});
  map.updateVehicles([]);
  map.showDistricts(false);
  sim?.hide();
  currentCtx = {
    ...loc,
    transport,
    liveFeed,
    map,
    sheet,
    sim,
    announce,
    lines: lineCache,
    getLine: (id) => lineCache.find((l) => l.id === id)
  };
  sheet.setLocked(Boolean(View.sheetLocked));

  sheet.set(window.matchMedia('(min-width: 1024px)').matches ? 'full' : View.sheet || 'full');
  viewEl.classList.remove('is-entering');
  void viewEl.offsetWidth;
  viewEl.classList.add('is-entering');
  sheetEl.scrollTop = 0;
  viewEl.scrollTop = 0;

  try {
    await View.mount(viewEl, currentCtx);

    analytics.recurso('tela_montada', {
      tela: loc.view,
      mapaComLinha: Boolean(viewEl.querySelector('[data-vehicles], [data-upcoming]')),
      distritos: Boolean(document.querySelector('.district-legend')),
      simulacao: Boolean(document.querySelector('.sim-float:not([hidden])'))
    });
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = '<p class="empty">Não foi possível carregar esta tela.</p>';
    analytics.registra('erro', 'falha_ao_montar_tela', { tela: loc.view, mensagem: String(err && err.message).slice(0, 200) });
  }
  document.title = `${View.title ? `${View.title} | ` : ''}Amarelinho Tarifa Zero Magé`;
}

document.querySelector('.bottomnav')?.addEventListener('click', (e) => {
  const a = e.target.closest('a[aria-current="page"]');
  if (!a || window.matchMedia('(min-width: 1024px)').matches || sheetEl.hasAttribute('data-locked')) return;
  e.preventDefault();
  sheet.cycle();
});

async function boot() {
  viewEl.innerHTML = `<div class="boot"><div class="line-grid">${skeletonCards(6)}</div></div>`;
  sheet.set('full', false);
  lineCache = await transport.getLines();
  await Promise.all(lineCache.filter((l) => l.hasShape).flatMap((l) => l.directions.map(async (d) => {
    const shape = await transport.getShape(l.id, d.id);
    map.registerShape(l.id, d.id, shape.points);
  })));

  document.getElementById('locate').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.setAttribute('aria-busy', 'true');
    try { await map.locateUser(); announce('Mapa centralizado na sua localização.'); } catch { announce('Não foi possível obter sua localização.'); }
    btn.removeAttribute('aria-busy');
  });

  window.addEventListener('hashchange', render);
  render();
}

boot();
