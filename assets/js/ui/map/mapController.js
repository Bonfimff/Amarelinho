// Controlador do mapa (Leaflet + OpenStreetMap). Apresentação apenas: recebe dados prontos da camada de serviço.
import { APP_CONFIG } from '../../config.js';
import { courseAtDistance, pointAtDistance, sliceRoute } from '../../lib/geo.js';
import { amarelinhoIso, isoPose, isoQuadrant, stableIsoQuadrant } from '../icons.js';
import { esc } from '../../lib/text.js';
import { BASE_STYLE } from './baseStyle.js';
import { MAGE_DISTRICTS } from '../../data/geo/mage-districts.js';

const L = window.L;
// Limites aproximados do município de Magé (Inhomirim/Santo Aleixo ao norte, Suruí e a baía ao sul).
const MIN_FIT_PX = 80; // altura minima de mapa preservada ao enquadrar
// Trecho de rota (em pixels de tela) usado para definir para onde o onibus aponta.
const COURSE_PX = 80;
const COURSE_MIN_M = 60;
const COURSE_MAX_M = 2000;
const MAGE_BOUNDS = [[-22.56, -43.21], [-22.71, -43.01]];

export class MapController {
  #map;
  #districtLayer;
  #districtsOn = false;
  #routeLayer;
  #stopLayer;
  #vehicleLayer;
  #shapes = new Map(); // `${lineId}:${directionId}` -> points
  #stopMarkers = new Map();
  #vehicles = new Map(); // id -> { marker, fromM, toM, start, duration, shapeKey, quadrant }
  #followId = null;
  #progressId = null; // viagem cujo trecho percorrido é pintado na rota
  #traveled = null;
  #lineKey = null; // linha/sentido exibido no mapa
  #selectedStopId = null;
  #handlers = { vehicle: () => {}, stop: () => {}, follow: () => {} };
  #bottomPad = 0;
  #userMarker = null;
  #lastPan = 0;

  constructor(el) {
    this.#map = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.25, preferCanvas: false })
      .fitBounds(MAGE_BOUNDS);
    // Mapa-base vetorial em estilo plano; sem WebGL, cai para os tiles raster do OpenStreetMap.
    const gl = L.maplibreGL && window.maplibregl?.supported?.() !== false;
    if (gl) {
      L.maplibreGL({ style: BASE_STYLE, attribution: APP_CONFIG.map.attribution + ' &middot; <a href="https://openfreemap.org">OpenFreeMap</a>' }).addTo(this.#map);
    } else {
      L.tileLayer(APP_CONFIG.map.tiles, { attribution: APP_CONFIG.map.attribution, maxZoom: 19, className: 'base-tiles' }).addTo(this.#map);
    }
    L.control.zoom({ position: 'topright' }).addTo(this.#map);
    // Abaixo de tudo: a divisão distrital, quando a tela inicial a pede no computador.
    this.#districtLayer = L.layerGroup().addTo(this.#map);
    this.#routeLayer = L.layerGroup().addTo(this.#map);
    this.#stopLayer = L.layerGroup().addTo(this.#map);
    this.#vehicleLayer = L.layerGroup().addTo(this.#map);
    this.#map.on('dragstart', () => { if (this.#followId) this.setFollow(null, { byUser: true }); });
    // A divisão distrital depende da largura da janela: revê quando ela muda.
    window.addEventListener('resize', () => this.#renderDistricts());
    window.matchMedia('(min-width: 1024px)').addEventListener('change', () => this.#renderDistricts());
    // O contêiner pode nascer sem tamanho (aba em segundo plano, rotação). Enquadramentos ficam pendentes até haver área visível.
    let lastSize = '';
    new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      this.#map.invalidateSize({ pan: false });
      this.#renderDistricts(); // a divisão distrital só cabe no computador; revê a cada mudança de tamanho
      if (this.#hasSize() && this.#pendingView) { const run = this.#pendingView; this.#pendingView = null; run(); }
    }).observe(el);
    requestAnimationFrame(() => this.#animate());
  }

  #pendingView = null;

  #hasSize() {
    const s = this.#map.getContainer();
    return s.clientWidth > 0 && s.clientHeight > 0;
  }

  /** Executa uma mudança de enquadramento agora ou quando o mapa tiver tamanho. */
  #whenSized(fn) {
    if (this.#hasSize()) fn(); else this.#pendingView = fn;
  }

  get leaflet() { return this.#map; }

  on(event, handler) { this.#handlers[event] = handler; }

  /** Espaço ocupado pelo painel inferior no celular, para enquadrar a rota acima dele. */
  setBottomPadding(px) {
    this.#bottomPad = px;
  }

  #fitPadding() {
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    if (desktop) return { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40] };
    // O painel pode cobrir quase toda a tela; limita o recuo para sempre sobrar area util
    // de mapa, senao o enquadramento vira (NaN, NaN) e derruba a tela.
    const el = this.#map.getContainer();
    const top = 72;
    const maxBottom = Math.max(0, el.clientHeight - top - MIN_FIT_PX);
    return { paddingTopLeft: [24, top], paddingBottomRight: [24, Math.min(this.#bottomPad + 24, maxBottom)] };
  }

  showOverview() {
    this.clearLine();
    this.fitRoute();
  }

  clearLine() {
    this.#routeLayer.clearLayers();
    this.#stopLayer.clearLayers();
    this.#stopMarkers.clear();
    this.#traveled = null;
    this.#lineKey = null;
  }

  registerShape(lineId, directionId, points) {
    this.#shapes.set(`${lineId}:${directionId}`, points);
  }

  showLine({ lineId, directionId, points, stops, fit = true }) {
    this.clearLine();
    this.registerShape(lineId, directionId, points);
    this.#lineKey = `${lineId}:${directionId}`;
    const latlngs = points.map((p) => [p[0], p[1]]);
    L.polyline(latlngs, { color: '#ffffff', weight: 9, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.#routeLayer);
    L.polyline(latlngs, { color: '#F5B800', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.#routeLayer);
    this.#traveled = L.polyline([], { color: '#2152C4', weight: 5, opacity: 0.9, lineCap: 'round', interactive: false }).addTo(this.#routeLayer);

    stops.forEach((stop, i) => {
      const terminal = i === 0 || i === stops.length - 1;
      const marker = terminal
        ? L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({ className: '', html: `<div class="term-mk ${i === 0 ? 'is-origin' : 'is-dest'}"><svg viewBox="0 0 30 40" aria-hidden="true"><path class="term-mk__pin" d="M15 1.5C7.5 1.5 1.5 7.4 1.5 14.8c0 9.6 11.2 21.6 12.4 22.9a1.5 1.5 0 0 0 2.2 0c1.2-1.3 12.4-13.3 12.4-22.9C28.5 7.4 22.5 1.5 15 1.5Z"/><circle class="term-mk__dot" cx="15" cy="14.5" r="5.2"/></svg></div>`, iconSize: [30, 40], iconAnchor: [15, 39] }),
          keyboard: true, title: stop.name, riseOnHover: true, zIndexOffset: 500
        })
        : L.circleMarker([stop.lat, stop.lng], { radius: 6, color: '#1A3F99', weight: 3, fillColor: '#ffffff', fillOpacity: 1 });
      marker.bindTooltip(`<strong>${esc(stop.name)}</strong><br><span>Ponto ${stop.sequence} de ${stops.length}</span>`, { direction: 'top', offset: [0, terminal ? -36 : -6], className: 'stop-tip' });
      marker.on('click', () => this.#handlers.stop(stop));
      marker.addTo(this.#stopLayer);
      this.#stopMarkers.set(stop.id, { marker, terminal });
    });
    if (this.#selectedStopId) this.highlightStop(this.#selectedStopId);
    if (fit) this.fitRoute(points);
  }

  /** O enquadramento abre sempre sobre o município de Magé (incluindo o trajeto exibido). */
  fitRoute(points = [], { onlyRoute = false } = {}) {
    const b = onlyRoute && points.length ? L.latLngBounds([[points[0][0], points[0][1]]]) : L.latLngBounds(MAGE_BOUNDS);
    points.forEach((p) => b.extend([p[0], p[1]]));
    this.#whenSized(() => this.#map.flyToBounds(b, { ...this.#fitPadding(), duration: 0.7 }));
  }

  highlightStop(stopId, { pan = false } = {}) {
    this.#selectedStopId = stopId;
    this.#stopMarkers.forEach(({ marker, terminal }, id) => {
      if (terminal) {
        marker.getElement()?.classList.toggle('is-selected', id === stopId);
        return;
      }
      const sel = id === stopId;
      marker.setStyle({ radius: sel ? 10 : 6, color: '#1A3F99', weight: sel ? 4 : 3, fillColor: sel ? '#FFD100' : '#ffffff' });
      if (sel) marker.bringToFront();
    });
    const entry = this.#stopMarkers.get(stopId);
    if (entry && pan) {
      this.#whenSized(() => {
        const zoom = Math.max(this.#map.getZoom(), 15);
        const desktop = window.matchMedia('(min-width: 1024px)').matches;
        // No celular, desloca o alvo para que o ponto fique visível acima do painel inferior.
        const target = desktop ? entry.marker.getLatLng()
          : this.#map.unproject(this.#map.project(entry.marker.getLatLng(), zoom).add([0, this.#bottomPad / 2 - 20]), zoom);
        this.#map.flyTo(target, zoom, { duration: 0.6 });
        entry.marker.openTooltip();
      });
    }
  }

  clearStopHighlight() { this.highlightStop(null); }

  /** Pinta os pontos conforme o andamento da viagem acompanhada: passados, próximo e à frente. */
  setStopProgress({ passedIds = [], nextId = null } = {}) {
    const passed = new Set(passedIds);
    this.#stopMarkers.forEach(({ marker, terminal }, id) => {
      if (terminal) {
        marker.getElement()?.classList.toggle('is-passed', passed.has(id));
        return;
      }
      const isNext = id === nextId;
      marker.setStyle({
        radius: isNext ? 9 : 6,
        color: '#1A3F99',
        weight: isNext ? 4 : 3,
        fillColor: isNext ? '#FFD100' : passed.has(id) ? '#1A3F99' : '#ffffff'
      });
    });
  }

  /** Recebe um snapshot do feed e anima cada veículo ao longo da rota até a nova posição. */
  updateVehicles(vehicles, { animateMs = 1000 } = {}) {
    const seen = new Set();
    const now = performance.now();
    // Uma linha por vez: com um trajeto exibido, só aparecem os ônibus dessa linha e sentido.
    if (this.#lineKey) vehicles = vehicles.filter((v) => `${v.lineId}:${v.directionId}` === this.#lineKey);
    vehicles.forEach((v) => {
      seen.add(v.id);
      const shapeKey = `${v.lineId}:${v.directionId}`;
      let entry = this.#vehicles.get(v.id);
      if (!entry) {
        const marker = L.marker([v.position.lat, v.position.lng], {
          icon: L.divIcon({ className: '', html: this.#busHtml(v), iconSize: [66, 66], iconAnchor: [33, 33] }),
          keyboard: true, title: `Amarelinho ${v.lineId}, saída das ${v.scheduledDeparture}, sentido ${v.headsign} (posição simulada)`, zIndexOffset: 1000
        });
        marker.on('click', () => this.#handlers.vehicle(v.id));
        marker.addTo(this.#vehicleLayer);
        entry = { marker, fromM: v.alongM, toM: v.alongM, start: now, duration: 0, shapeKey, quadrant: isoQuadrant(v.position.bearing) };
        this.#vehicles.set(v.id, entry);
      } else {
        const current = this.#currentAlong(entry, now);
        const jump = Math.abs(v.alongM - current) > 4000 || v.alongM < current - 50;
        entry.fromM = jump ? v.alongM : current;
        entry.toM = v.alongM;
        entry.start = now;
        entry.duration = jump ? 0 : animateMs;
      }
      entry.status = v.status;
      entry.marker.getElement()?.classList.toggle('is-stopped', v.status !== 'in_transit');
    });
    [...this.#vehicles.keys()].filter((id) => !seen.has(id)).forEach((id) => {
      this.#vehicleLayer.removeLayer(this.#vehicles.get(id).marker);
      this.#vehicles.delete(id);
      if (this.#followId === id) this.setFollow(null);
    });
    this.#applyFollowClass();
  }

  #busHtml(v) {
    const o = isoPose(v.position.bearing);
    return `<div class="bus-mk"><span class="bus-mk__vehicle ${o.mirror ? 'is-mirrored' : ''}" data-pose="${o.variant}:${o.yaw}">${amarelinhoIso(o.variant, o.yaw)}</span><span class="bus-mk__tag">${esc(v.lineId)}</span></div>`;
  }

  /**
   * Comprimento de rota, em metros, que define o rumo do ícone: sempre o mesmo trecho
   * visual (COURSE_PX), então com pouco zoom a janela é longa e a vista para de oscilar.
   */
  #courseWindow() {
    const mPerPx = (156543.03392 * Math.cos((this.#map.getCenter().lat * Math.PI) / 180)) / 2 ** this.#map.getZoom();
    return Math.min(COURSE_MAX_M, Math.max(COURSE_MIN_M, mPerPx * COURSE_PX));
  }

  /** Desenha o ônibus alinhado à via: a guinada segue o rumo e a vista troca a cada quadrante. */
  #orient(el, entry, course) {
    const vehicle = el.querySelector('.bus-mk__vehicle');
    if (!vehicle) return;
    entry.quadrant = stableIsoQuadrant(course, entry.quadrant);
    const o = isoPose(course, entry.quadrant);
    const pose = `${o.variant}:${o.yaw}`;
    if (vehicle.dataset.pose === pose) return;
    vehicle.dataset.pose = pose;
    vehicle.innerHTML = amarelinhoIso(o.variant, o.yaw);
    vehicle.classList.toggle('is-mirrored', o.mirror);
  }

  #currentAlong(entry, now) {
    if (!entry.duration) return entry.toM;
    const t = Math.min(1, (now - entry.start) / entry.duration);
    return entry.fromM + (entry.toM - entry.fromM) * t;
  }

  #animate() {
    requestAnimationFrame(() => this.#animate());
    if (!this.#hasSize()) return;
    const now = performance.now();
    // Sem ônibus escolhido, o trecho percorrido acompanha o ônibus em circulação na linha exibida.
    let progressId = this.#progressId || this.#followId;
    if (!progressId && this.#lineKey) {
      for (const [id, e] of this.#vehicles) if (e.shapeKey === this.#lineKey && e.status !== 'arrived') { progressId = id; break; }
    }
    if (!progressId && this.#traveled) this.#traveled.setLatLngs([]);
    const courseWindow = this.#courseWindow();
    this.#vehicles.forEach((entry, id) => {
      const points = this.#shapes.get(entry.shapeKey);
      if (!points) return;
      const along = this.#currentAlong(entry, now);
      const p = pointAtDistance(points, along);
      entry.marker.setLatLng([p.lat, p.lng]);
      const el = entry.marker.getElement();
      if (el) this.#orient(el, entry, courseAtDistance(points, along, courseWindow));
      if (id === progressId && this.#traveled) {
        this.#traveled.setLatLngs(sliceRoute(points, 0, along));
      }
      if (id === this.#followId) {
        if (now - this.#lastPan > 350) {
          this.#lastPan = now;
          this.#panKeepingSheet([p.lat, p.lng]);
        }
      }
    });
  }

  #panKeepingSheet(latlng) {
    if (!this.#hasSize()) return;
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    if (desktop) { this.#map.panTo(latlng, { animate: true, duration: 0.35 }); return; }
    const target = this.#map.project(latlng).add([0, this.#bottomPad / 2 - 20]);
    this.#map.panTo(this.#map.unproject(target), { animate: true, duration: 0.35 });
  }

  focusVehicle(id, zoom = 15) {
    const entry = this.#vehicles.get(id);
    if (!entry) return false;
    this.#whenSized(() => {
      this.#map.setZoom(Math.max(this.#map.getZoom(), zoom), { animate: false });
      this.#panKeepingSheet(entry.marker.getLatLng());
    });
    return true;
  }

  setFollow(id, { byUser = false } = {}) {
    this.#followId = id;
    if (!id && !this.#progressId && this.#traveled) this.#traveled.setLatLngs([]);
    this.#applyFollowClass();
    this.#handlers.follow({ id, byUser });
  }

  get followId() { return this.#followId; }

  /** Pinta o trecho já percorrido por esta viagem, com ou sem a câmera seguindo o ônibus. */
  setProgressVehicle(id) {
    this.#progressId = id;
    if (!id && !this.#followId && this.#traveled) this.#traveled.setLatLngs([]);
  }

  #applyFollowClass() {
    this.#vehicles.forEach((entry, id) => entry.marker.getElement()?.classList.toggle('is-followed', id === this.#followId));
  }

  /**
   * Divisão distrital de Magé, só no computador: contorno claro por cima do mapa, sem tampar
   * ruas nem rótulos. No celular não cabe, então o pedido fica guardado e volta se a tela crescer.
   */
  showDistricts(on) {
    this.#districtsOn = Boolean(on);
    this.#renderDistricts();
  }

  #renderDistricts() {
    const mostrar = this.#districtsOn && window.matchMedia('(min-width: 1024px)').matches;
    if (!mostrar) { this.#districtLayer.clearLayers(); return; }
    if (this.#districtLayer.getLayers().length) return;
    MAGE_DISTRICTS.forEach((d) => {
      d.aneis.forEach((anel) => {
        L.polygon(anel, {
          color: '#1A3F99', weight: 1.5, opacity: .45, dashArray: '6 5',
          fillColor: '#2152C4', fillOpacity: .05, interactive: false
        }).addTo(this.#districtLayer);
      });
      L.marker(d.rotulo, {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: '', html: `<span class="district-label">${esc(d.nome)}</span>`, iconSize: [0, 0] })
      }).addTo(this.#districtLayer);
    });
  }

  locateUser() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocalização indisponível neste navegador.')); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        if (this.#userMarker) this.#userMarker.setLatLng(ll);
        else this.#userMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="user-mk"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), title: 'Sua localização' }).addTo(this.#map);
        this.#map.flyTo(ll, 15, { duration: 0.6 });
        resolve(ll);
      }, (err) => reject(err), { enableHighAccuracy: true, timeout: 8000 });
    });
  }

  invalidate() { this.#map.invalidateSize(); }
}
