import { esc } from '../../lib/text.js';
import { haversine } from '../../lib/geo.js';
import { STAND_IDS, PLACES, placeById } from '../../data/mock/mototaxi/places.js';
import { moto3d, headingStep, MOTO3D_BOX } from './moto3d.js';

const L = window.L;

const COLORS = { disponivel: '#3DA83A', a_caminho: '#F2B900', no_local: '#F2B900', em_corrida: '#2152C4', offline: '#8A94A6' };
const labelOf = { disponivel: 'Disponível', a_caminho: 'A caminho do passageiro', no_local: 'No local de embarque', em_corrida: 'Em corrida', offline: 'Offline' };
const MOTO_W = 64;
const MOTO_H = Math.round((MOTO_W * MOTO3D_BOX.h) / MOTO3D_BOX.w);
const GLIDE_MS = 260;

const pin = (kind) => `<div class="term-mk ${kind}"><svg viewBox="0 0 30 40" aria-hidden="true"><path class="term-mk__pin" d="M15 1.5C7.5 1.5 1.5 7.4 1.5 14.8c0 9.6 11.2 21.6 12.4 22.9a1.5 1.5 0 0 0 2.2 0c1.2-1.3 12.4-13.3 12.4-22.9C28.5 7.4 22.5 1.5 15 1.5Z"/><circle class="term-mk__dot" cx="15" cy="14.5" r="5.2"/></svg></div>`;

export class MotoMap {
  #ctl;
  #map;
  #layer;
  #markers = new Map();
  #pins = { origin: null, dest: null, key: '' };
  #lines = {};
  #legLatLngs = null;
  #legDriver = null;
  #onClick = null;
  #userMk = null;
  #walk = null;
  #following = false;
  #lastPan = 0;
  #raf = 0;
  #onDriver = () => {};
  #onDrag = () => { this.#following = false; };
  #mapClick = (e) => this.#onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });

  constructor(mapController) {
    this.#ctl = mapController;
    this.#map = mapController.leaflet;
    this.#layer = L.layerGroup().addTo(this.#map);
    this.#drawStands();
    this.#map.on('click', this.#mapClick);

    this.#map.on('dragstart', this.#onDrag);
    const loop = () => { this.#glide(); this.#raf = requestAnimationFrame(loop); };
    this.#raf = requestAnimationFrame(loop);
  }

  onDriver(fn) { this.#onDriver = fn; }

  #drawStands() {
    STAND_IDS.forEach((id) => {
      const p = placeById(id);
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: '<div class="stand-mk" aria-hidden="true">P</div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        keyboard: false, title: `Ponto de demonstração: ${p.name}`, zIndexOffset: 100
      }).bindTooltip(`<strong>Ponto de demonstração</strong><br>${esc(p.name)}`, { direction: 'top', offset: [0, -10], className: 'stop-tip' }).addTo(this.#layer);
    });
  }

  fit(latlngs = null) {
    let pts = latlngs || PLACES.map((p) => [p.lat, p.lng]);

    if (pts.length) {
      const lats = pts.map((p) => p[0]);
      const lngs = pts.map((p) => p[1]);
      const spanLat = Math.max(...lats) - Math.min(...lats);
      const spanLng = Math.max(...lngs) - Math.min(...lngs);
      if (spanLat < 0.002 && spanLng < 0.002) {
        const cLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const cLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
        pts = [...pts, [cLat - 0.0015, cLng - 0.0015], [cLat + 0.0015, cLng + 0.0015]];
      }
    }
    this.#ctl.fitRoute(pts, { onlyRoute: true });
  }

  pickMode(fn) {
    this.#onClick = fn;
    this.#map.getContainer().classList.toggle('is-picking', Boolean(fn));
  }

  setDrivers(drivers) {
    const seen = new Set();
    const now = performance.now();
    drivers.forEach((d) => {
      seen.add(d.id);
      const to = [d.lat, d.lng];
      const color = COLORS[d.status] || COLORS.offline;
      const pose = `${headingStep(d.heading ?? 90)}|${color}|${d.carrying ? 1 : 0}`;
      const sig = `${d.selected ? 1 : 0}|${d.name}`;
      let m = this.#markers.get(d.id);
      if (!m) {
        const marker = L.marker(to, { icon: this.#icon(d, color, sig), keyboard: true, zIndexOffset: 700, riseOnHover: true });
        marker.on('click', () => this.#onDriver(d.id));
        marker.addTo(this.#layer);
        m = { marker, from: to, to, t0: now, shown: to, pose: '', sig };
        this.#markers.set(d.id, m);
      } else {
        if (m.sig !== sig) { m.marker.setIcon(this.#icon(d, color, sig)); m.sig = sig; m.pose = ''; }

        const far = haversine(m.shown[0], m.shown[1], to[0], to[1]) > 400;
        m.from = far ? to : m.shown;
        m.to = to;
        m.t0 = now;
      }
      if (m.pose !== pose) {
        const v = m.marker.getElement()?.querySelector('.moto-mk__v');
        if (v) { v.innerHTML = moto3d(d.heading ?? 90, color, d.carrying); m.pose = pose; }
      }
      m.marker.setZIndexOffset(d.selected ? 900 : 700);
      const title = `${d.name}: ${labelOf[d.status] || d.status}`;
      m.marker.getElement()?.setAttribute('title', title);
      m.marker.getElement()?.setAttribute('aria-label', title);
    });
    for (const [id, m] of this.#markers) {
      if (!seen.has(id)) { this.#layer.removeLayer(m.marker); this.#markers.delete(id); }
    }
  }

  #icon(d, color, sig) {
    return L.divIcon({
      className: '',
      html: `<div class="moto-mk ${d.selected ? 'is-selected' : ''}" data-sig="${esc(sig)}" style="--c:${color}"><span class="moto-mk__v">${moto3d(d.heading ?? 90, color, d.carrying)}</span><span class="moto-mk__name">${esc(d.name)}</span></div>`,
      iconSize: [MOTO_W, MOTO_H],

      iconAnchor: [MOTO_W / 2, Math.round(MOTO_H * MOTO3D_BOX.groundY)]
    });
  }

  #glide() {
    const now = performance.now();
    for (const m of this.#markers.values()) {
      const k = Math.min(1, (now - m.t0) / GLIDE_MS);
      const p = k >= 1 ? m.to : [m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k];
      if (p[0] !== m.shown[0] || p[1] !== m.shown[1]) { m.marker.setLatLng(p); m.shown = p; }
    }

    if (this.#legLatLngs && this.#legDriver) {
      const m = this.#markers.get(this.#legDriver);
      if (m && this.#legLatLngs.length) {
        const pts = [m.shown, ...this.#legLatLngs];
        this.#lines.legCase?.setLatLngs(pts);
        this.#lines.leg?.setLatLngs(pts);
      }
    }
  }

  #line(name, latlngs, style) {
    if (!latlngs || latlngs.length < 2) {
      if (this.#lines[name]) { this.#layer.removeLayer(this.#lines[name]); delete this.#lines[name]; }
      return;
    }
    if (this.#lines[name]) this.#lines[name].setLatLngs(latlngs);
    else this.#lines[name] = L.polyline(latlngs, { interactive: false, lineCap: 'round', lineJoin: 'round', ...style }).addTo(this.#layer);
  }

  setTrip({ origin = null, dest = null, plan = null, leg = null, legKind = null, driverId = null } = {}) {
    const ride = legKind === 'ride';
    this.#line('planCase', plan, { color: '#ffffff', weight: 9, opacity: 1 });
    this.#line('plan', plan, { color: '#F5B800', weight: 5, opacity: 1 });

    const legOk = leg && leg.length >= 2;
    this.#line('legCase', legOk ? leg : null, { color: '#ffffff', weight: ride ? 10 : 7, opacity: ride ? 1 : 0.9 });
    this.#line('leg', legOk ? leg : null, ride ? { color: '#F5B800', weight: 5, opacity: 1 } : { color: '#14337E', weight: 4, opacity: 0.85, dashArray: '8 7' });
    if (this.#lines.leg) this.#lines.leg.setStyle(ride ? { color: '#F5B800', weight: 5, opacity: 1, dashArray: null } : { color: '#14337E', weight: 4, opacity: 0.85, dashArray: '8 7' });
    if (this.#lines.legCase) this.#lines.legCase.setStyle({ weight: ride ? 10 : 7, opacity: ride ? 1 : 0.9 });
    this.#legLatLngs = legOk ? leg : null;
    this.#legDriver = legOk ? driverId : null;
    if (this.#lines.legCase) this.#lines.legCase.bringToFront();
    if (this.#lines.leg) this.#lines.leg.bringToFront();

    const key = `${origin ? `${origin.lat},${origin.lng}` : ''}|${dest ? `${dest.lat},${dest.lng}` : ''}|${origin?.name}|${dest?.name}`;
    if (key === this.#pins.key) return;
    this.#pins.key = key;
    ['origin', 'dest'].forEach((k) => { if (this.#pins[k]) { this.#layer.removeLayer(this.#pins[k]); this.#pins[k] = null; } });
    const mk = (p, kind, label) => L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: pin(kind), iconSize: [30, 40], iconAnchor: [15, 39] }), zIndexOffset: 600, title: label
    }).bindTooltip(`<strong>${label}</strong><br>${esc(p.name)}`, { direction: 'top', offset: [0, -36], className: 'stop-tip' }).addTo(this.#layer);
    if (origin) this.#pins.origin = mk(origin, 'is-origin', 'Embarque');
    if (dest) this.#pins.dest = mk(dest, 'is-dest', 'Destino');
  }

  setUser(pos) {
    if (!pos) { if (this.#userMk) { this.#layer.removeLayer(this.#userMk); this.#userMk = null; } return; }
    if (this.#userMk) this.#userMk.setLatLng([pos.lat, pos.lng]);
    else this.#userMk = L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: '', html: '<div class="user-mk"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), title: 'Sua localização', zIndexOffset: 900 }).addTo(this.#layer);
  }

  setWalk(from, to) {
    if (this.#walk) { this.#layer.removeLayer(this.#walk); this.#walk = null; }
    if (from && to) this.#walk = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: '#2E66DB', weight: 3, dashArray: '2 6', opacity: .9, interactive: false }).addTo(this.#layer);
  }

  follow(on) { this.#following = Boolean(on); }

  track(pos) {
    if (!this.#following || !pos) return;
    const now = performance.now();
    if (now - this.#lastPan < 900) return;
    this.#lastPan = now;
    this.#map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.8, easeLinearity: 1 });
  }

  bounds(items) {
    return items.filter((i) => i && i.lat != null).map((i) => [i.lat, i.lng]);
  }

  destroy() {
    cancelAnimationFrame(this.#raf);
    this.#map.off('click', this.#mapClick);
    this.#map.off('dragstart', this.#onDrag);
    this.#map.getContainer().classList.remove('is-picking');
    this.#map.removeLayer(this.#layer);
  }
}
