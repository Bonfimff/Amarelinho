import { html, raw } from '../../lib/text.js';
import { icons } from '../icons.js';
import { href, navigate } from '../router.js';
import { simBadge, demoNotice, vehicleLocationText } from '../components.js';
import { formatEta, operationStatus } from '../../lib/time.js';
import { formatDistance } from '../../lib/geo.js';
import { BANNERS } from '../../data/official/banners.js';
import { BannerCarousel } from '../carousel.js';

export default {
  sheetLocked: true,
  title: 'Início',

  async mount(el, ctx) {
    const { lines, transport, liveFeed, map } = ctx;
    const demo = transport.demo;

    el.innerHTML = html`
      <section data-banner></section>

      ${demo ? raw(html`
      <section class="card live-card" aria-labelledby="live-title">
        <div class="card-head">
          <h2 id="live-title" class="card-title">${raw(icons.bus())}Ônibus agora</h2>
          ${raw(simBadge('Localização simulada'))}
        </div>
        <div class="live-card__line">
          <span class="line-chip line-chip--lg">TZ01</span>
          <div class="live-card__info">
            <p class="live-card__route">Piabetá <span aria-hidden="true">x</span> Magé</p>
            <p class="muted" data-home-loc>Carregando posição...</p>
          </div>
        </div>
        <dl class="live-card__stats">
          <div><dt>Próximo ponto</dt><dd data-home-next>–</dd></div>
          <div><dt>Chegada</dt><dd class="is-eta" data-home-eta>–</dd></div>
          <div><dt>Distância</dt><dd data-home-dist>–</dd></div>
        </dl>
        <div class="live-card__actions">
          <button class="btn btn--primary btn--lg" type="button" data-follow>${raw(icons.play())}Acompanhar ônibus</button>
          <a class="btn btn--secondary" href="${href('/linha/TZ01')}">Ver pontos e horários</a>
        </div>
      </section>`) : ''}

      ${raw(demoNotice())}
      <p class="foot-links"><a href="${href('/sobre')}">Sobre o projeto</a> · <a href="${href('/sobre')}">Fontes das informações</a></p>
      <a class="dev-credit" href="https://www.exksvol.com" target="_blank" rel="noopener" aria-label="Exksvol, desenvolvedora do protótipo (abre em nova aba)">
        <span class="dev-credit__label">Desenvolvido por</span>
        <img src="assets/brand/exksvol.png" alt="Exksvol Systems" width="790" height="160" />
      </a>
    `;

    const bannerEl = el.querySelector('[data-banner]');
    const searchCard = {
      id: 'busca',
      title: 'Para onde você vai?',
      html: html`
        <div class="hero">
          <p class="ribbon">Amarelinhos · Tarifa Zero</p>
          <h1 class="hero__title">Para onde você vai?</h1>
          <form class="search search--hero" role="search" data-search>
            <label class="sr-only" for="home-q">Digite uma linha, ponto ou destino</label>
            <span class="search__icon">${raw(icons.search())}</span>
            <input id="home-q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Linha, ponto ou destino" />
            <button class="btn btn--primary search__btn" type="submit">Buscar</button>
          </form>
          <div class="quick" aria-label="Sugestões de busca">
            ${['Piabetá', 'Rodoviária de Magé', 'Suruí', 'Hospital do Olho', 'TZ09'].map((q) => html`<a class="chip" href="${href('/buscar', { q })}">${q}</a>`)}
          </div>
        </div>`
    };
    this.carousel = new BannerCarousel(bannerEl, [searchCard, ...BANNERS]);

    el.querySelector('[data-search]').addEventListener('submit', (e) => {
      e.preventDefault();
      navigate('/buscar', { q: new FormData(e.currentTarget).get('q').trim() });
    });

    if (!demo) return;

    el.querySelector('[data-follow]').addEventListener('click', () => {
      transport.clock?.play();
      navigate('/ao-vivo');
    });

    const tz01 = lines.find((l) => l.id === 'TZ01');

    map.showOverview();
    map.showDistricts(true);

    const render = (snap) => {
      const v = snap.vehicles.find((x) => x.id === demo.vehicleId) || snap.vehicles.find((x) => x.lineId === 'TZ01' && x.status !== 'arrived');
      const set = (sel, txt) => { const n = el.querySelector(sel); if (n) n.textContent = txt; };
      if (!v) { set('[data-home-loc]', tz01 && operationStatus(tz01.operatingHours).open ? 'Nenhum ônibus em circulação neste momento.' : 'Fora do horário de operação.'); return; }
      set('[data-home-loc]', vehicleLocationText(v));
      set('[data-home-next]', v.nextStop ? v.nextStop.name : 'Chegou ao destino');
      set('[data-home-eta]', v.nextStop ? formatEta(v.nextStop.etaSec) : '–');
      set('[data-home-dist]', v.nextStop ? formatDistance(v.nextStop.distanceM) : '–');
    };

    this.off = liveFeed.on('update', render);
    render(await liveFeed.watch('TZ01'));

  },

  unmount() { this.off?.(); this.carousel?.destroy(); document.querySelector('dialog.lightbox')?.remove(); }
};
