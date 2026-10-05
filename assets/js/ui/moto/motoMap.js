// Camadas do mototáxi sobre o mapa já existente: corredor da demonstração, pontos, motos e corrida.
// Usa o Leaflet do MapController, mas mantém tudo numa camada própria que sai junto com a tela.
import { icons } from '../icons.js';
import { esc } from '../../lib/text.js';
import { CORRIDOR, STAND_IDS, placeById, latLngAt, pathBetween, nearestAlong } from '../../data/mock/mototaxi/corridor.js';

const L = window.L;

// Cor de cada situação do profissional no mapa. Além da cor, o rótulo vai no tooltip.
const COLORS = { disponivel: '#3DA83A', a_caminho: '#F2B900', no_local: '#F2B900', em_corrida: '#2152C4', offline: '#8A94A6' };
const labelOf = { disponivel: 'Disponível', a_caminho: 'A caminho do passageiro', no_local: 'No local de embarque', em_corrida: 'Em corrida', offline: 'Offline' };

const pin = (kind) => `<div class="term-mk ${kind}"><svg viewBox="0 0 30 40" aria-hidden="true"><path class="term-mk__pin" d="M15 1.5C7.5 1.5 1.5 7.4 1.5 14.8c0 9.6 11.2 21.6 12.4 22.9a1.5 1.5 0 0 0 2.2 0c1.2-1.3 12.4-13.3 12.4-22.9C28.5 7.4 22.5 1.5 15 1.5Z"/><circle class="term-mk__dot" cx="15" cy="14.5" r="5.2"/></svg></div>`;

export class MotoMap {
  #ctl;
  #map;
  #layer;
  #markers = new Map();
  #stands = [];
  #pins = [];
  #route = [];
  #pickup = null;
  #onClick = null;
  #onDriver = () => {};
  #mapClick = (e) => this.#onClick?.(nearestAlong(e.latlng.lat, e.latlng.lng));

  constructor(mapController) {
    this.#ctl = mapController;
    this.#map = mapController.leaflet;
    this.#layer = L.layerGroup().addTo(this.#map);
    this.#drawCorridor();
    this.#map.on('click', this.#mapClick);
  }

  onDriver(fn) { this.#onDriver = fn; }

  #drawCorridor() {
    const latlngs = CORRIDOR.points.map((p) => [p[0], p[1]]);
    L.polyline(latlngs, { color: '#ffffff', weight: 8, opacity: .9, lineCap: 'round', interactive: false }).addTo(this.#layer);
    L.polyline(latlngs, { color: '#2152C4', weight: 3, opacity: .55, dashArray: '2 8', lineCap: 'round', interactive: false }).addTo(this.#layer);
    STAND_IDS.forEach((id) => {
      const p = placeById(id);
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: '<div class="stand-mk" aria-hidden="true">P</div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        keyboard: false, title: `Ponto de demonstração: ${p.name}`, zIndexOffset: 100
      }).bindTooltip(`<strong>Ponto de demonstração</strong><br>${esc(p.name)}`, { direction: 'top', offset: [0, -10], className: 'stop-tip' }).addTo(this.#layer);
    });
  }

  /** Enquadra o corredor inteiro (ou uma lista de coordenadas) acima do painel. */
  fit(latlngs = null) {
    this.#ctl.fitRoute(latlngs || CORRIDOR.points.map((p) => [p[0], p[1]]), { onlyRoute: true });
  }

  /** Quando alguém toca no mapa, devolve o ponto mais próximo do corredor. Passe null para encerrar. */
  pickMode(fn) {
    this.#onClick = fn;
    this.#map.getContainer().classList.toggle('is-picking', Boolean(fn));
  }

  /** Motos. `drivers` traz { id, name, status, along, selected }. Quem não vem na lista some do mapa. */
  setDrivers(drivers) {
    const seen = new Set();
    drivers.forEach((d, i) => {
      seen.add(d.id);
      const ll = latLngAt(d.along);
      // Afasta de leve motos no mesmo ponto, para não ficarem empilhadas.
      const off = ((Number(String(d.id).replace(/\D/g, '')) % 4) - 1.5) * 0.00007;
      const pos = [ll.lat + off, ll.lng + off];
      let m = this.#markers.get(d.id);
      if (!m) {
        m = L.marker(pos, { icon: this.#icon(d), keyboard: true, zIndexOffset: 700 });
        m.on('click', () => this.#onDriver(d.id));
        m.addTo(this.#layer);
        this.#markers.set(d.id, m);
      } else {
        m.setLatLng(pos);
        const el = m.getElement();
        const sig = `${d.status}|${d.selected ? 1 : 0}|${d.name}`;
        if (el && el.firstElementChild?.dataset.sig !== sig) m.setIcon(this.#icon(d));
      }
      m.options.title = `${d.name}: ${labelOf[d.status] || d.status}`;
      m.getElement()?.setAttribute('title', m.options.title);
    });
    for (const [id, m] of this.#markers) {
      if (!seen.has(id)) { this.#layer.removeLayer(m); this.#markers.delete(id); }
    }
  }

  #icon(d) {
    const color = COLORS[d.status] || COLORS.offline;
    return L.divIcon({
      className: '',
      html: `<div class="moto-mk ${d.selected ? 'is-selected' : ''}" data-sig="${d.status}|${d.selected ? 1 : 0}|${esc(d.name)}" style="--c:${color}">${icons.moto('moto-ico')}<span class="moto-mk__name">${esc(d.name)}</span></div>`,
      iconSize: [36, 36], iconAnchor: [18, 18]
    });
  }

  /** Trajeto da corrida (origem e destino) e, enquanto a moto vai buscar, o trecho até o passageiro. */
  setTrip({ origin = null, dest = null, driverAlong = null, showPickup = false, progressAlong = null } = {}) {
    this.#pins.forEach((p) => this.#layer.removeLayer(p));
    this.#pins = [];
    this.#route.forEach((r) => this.#layer.removeLayer(r));
    this.#route = [];
    if (this.#pickup) { this.#layer.removeLayer(this.#pickup); this.#pickup = null; }
    if (origin && dest) {
      const path = pathBetween(origin.along, dest.along);
      this.#route.push(L.polyline(path, { color: '#ffffff', weight: 10, opacity: 1, lineCap: 'round', interactive: false }).addTo(this.#layer));
      this.#route.push(L.polyline(path, { color: '#F5B800', weight: 5, opacity: 1, lineCap: 'round', interactive: false }).addTo(this.#layer));
      if (progressAlong != null) {
        const done = pathBetween(origin.along, Math.min(Math.max(progressAlong, Math.min(origin.along, dest.along)), Math.max(origin.along, dest.along)));
        this.#route.push(L.polyline(done, { color: '#2152C4', weight: 5, opacity: .95, lineCap: 'round', interactive: false }).addTo(this.#layer));
      }
    }
    const mk = (p, kind, label) => L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: pin(kind), iconSize: [30, 40], iconAnchor: [15, 39] }), zIndexOffset: 600, title: label
    }).bindTooltip(`<strong>${label}</strong><br>${esc(p.name)}`, { direction: 'top', offset: [0, -36], className: 'stop-tip' }).addTo(this.#layer);
    if (origin) this.#pins.push(mk(origin, 'is-origin', 'Embarque'));
    if (dest) this.#pins.push(mk(dest, 'is-dest', 'Destino'));
    if (showPickup && origin && driverAlong != null) {
      this.#pickup = L.polyline(pathBetween(driverAlong, origin.along), { color: '#14337E', weight: 4, opacity: .8, dashArray: '8 7', lineCap: 'round', interactive: false }).addTo(this.#layer);
    }
  }

  /** Coordenadas de um conjunto de locais e motos, para enquadrar a corrida. */
  bounds(items) {
    return items.filter((i) => i.along != null).map((i) => { const l = latLngAt(i.along); return [l.lat, l.lng]; });
  }

  destroy() {
    this.#map.off('click', this.#mapClick);
    this.#map.getContainer().classList.remove('is-picking');
    this.#map.removeLayer(this.#layer);
  }
}

