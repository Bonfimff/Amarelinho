import { Emitter } from '../../../lib/emitter.js';
import { decodeTile } from '../../../lib/mvt.js';
import { haversine } from '../../../lib/geo.js';

const Z = 14;
const EXT = 4096;
const WORLD = EXT * 2 ** Z;
const EARTH = 40075016.686;
const CELL = 128;
const TILEJSON = 'https://tiles.openfreemap.org/planet';

export const OMT_SCHEMA = {
  layer: 'transportation',
  classes: new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'busway']),
  level: (p) => (p.brunnel === 'bridge' || p.brunnel === 'tunnel' ? `${p.brunnel}:${p.layer ?? ''}` : ''),
  oneway: (p) => (p.oneway === 1 ? 1 : p.oneway === -1 ? -1 : 0)
};

const toLatLng = (X, Y) => {
  const lng = (X / WORLD) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / WORLD))) * 180) / Math.PI;
  return [lat, lng];
};
const toXY = (lat, lng) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * WORLD, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD];
};
const metersPerUnit = (Y) => (EARTH * Math.cos((toLatLng(0, Y)[0] * Math.PI) / 180)) / WORLD;

export function tileOf(lat, lng) {
  const [X, Y] = toXY(lat, lng);
  return [Math.floor(X / EXT), Math.floor(Y / EXT)];
}

export function tilesAround(points, radiusM) {
  const set = new Map();
  points.forEach(([lat, lng]) => {
    const [X, Y] = toXY(lat, lng);
    const r = radiusM / metersPerUnit(Y);
    for (let tx = Math.floor((X - r) / EXT); tx <= Math.floor((X + r) / EXT); tx += 1) {
      for (let ty = Math.floor((Y - r) / EXT); ty <= Math.floor((Y + r) / EXT); ty += 1) set.set(`${tx}/${ty}`, [tx, ty]);
    }
  });
  return [...set.values()];
}

function clipSeg(ax, ay, bx, by) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const edges = [[-dx, ax], [dx, EXT - ax], [-dy, ay], [dy, EXT - ay]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return t0 < t1 ? [t0, t1] : null;
}

function clipLine(pts) {
  const pieces = [];
  let cur = null;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const c = clipSeg(ax, ay, bx, by);
    if (!c) { cur = null; continue; }
    const p0 = [ax + (bx - ax) * c[0], ay + (by - ay) * c[0]];
    const p1 = [ax + (bx - ax) * c[1], ay + (by - ay) * c[1]];
    if (!cur) { cur = [p0]; pieces.push(cur); }
    cur.push(p1);
    if (c[1] < 1) cur = null;
  }
  return pieces.filter((p) => p.length > 1);
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const { k, v } = this;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop();
    const lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c += 1;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

export class RoadNet extends Emitter {
  schema;
  ready = false;
  #lines = [];
  #tiles = new Set();
  #loading = new Map();
  #tileUrl = null;

  nx = [];
  ny = [];
  adj = [];
  ea = [];
  eb = [];
  elen = [];
  edir = [];
  #main = null;
  #grid = new Map();
  #cache = new Map();

  constructor(schema = OMT_SCHEMA) {
    super();
    this.schema = schema;
  }

  get nodeCount() { return this.nx.length; }
  get edgeCount() { return this.ea.length; }
  hasTile(tx, ty) { return this.#tiles.has(`${tx}/${ty}`); }

  addTile(tx, ty, buffer) {
    const key = `${tx}/${ty}`;
    if (this.#tiles.has(key)) return;
    this.#tiles.add(key);
    const layer = decodeTile(buffer, [this.schema.layer])[this.schema.layer];
    if (!layer) return;
    const k = EXT / layer.extent;
    for (const f of layer.features) {
      if (f.type !== 2 || !this.schema.classes.has(f.props.class)) continue;
      const level = this.schema.level(f.props);
      const oneway = this.schema.oneway(f.props);
      for (const line of f.geometry) {
        const scaled = line.map(([x, y]) => [x * k, y * k]);
        for (const piece of clipLine(scaled)) {
          this.#lines.push({ pts: piece.map(([x, y]) => [tx * EXT + x, ty * EXT + y]), level, oneway });
        }
      }
    }
  }

  async load(tiles) {
    const missing = tiles.filter(([tx, ty]) => !this.hasTile(tx, ty));
    if (!missing.length) return;
    const url = await this.#resolveUrl();
    const queue = missing.slice();
    const worker = async () => {
      while (queue.length) {
        const [tx, ty] = queue.shift();
        const key = `${tx}/${ty}`;
        if (this.#loading.has(key)) { await this.#loading.get(key); continue; }
        const job = fetchTile(url.replace('{z}', Z).replace('{x}', tx).replace('{y}', ty))
          .then((buf) => this.addTile(tx, ty, buf))
          .catch(() => {})
          .finally(() => this.#loading.delete(key));
        this.#loading.set(key, job);
        await job;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.build();
  }

  async #resolveUrl() {
    if (this.#tileUrl) return this.#tileUrl;
    const res = await fetch(TILEJSON);
    if (!res.ok) throw new Error(`TileJSON ${res.status}`);
    const tj = await res.json();
    this.#tileUrl = tj.tiles[0];
    return this.#tileUrl;
  }

  build() {
    const segs = [];
    this.#lines.forEach((ln, li) => {
      for (let i = 0; i < ln.pts.length - 1; i += 1) {
        const [ax, ay] = ln.pts[i];
        const [bx, by] = ln.pts[i + 1];
        if (ax === bx && ay === by) continue;
        segs.push({ ax, ay, bx, by, li, level: ln.level, oneway: ln.oneway, splits: [] });
      }
    });
    this.#repair(segs);

    const ids = new Map();
    const nx = [];
    const ny = [];
    const border = new Map();
    const node = (x, y) => {
      const key = `${Math.round(x)},${Math.round(y)}`;
      let id = ids.get(key);
      if (id != null) return id;
      const onX = Math.abs(x / EXT - Math.round(x / EXT)) < 1e-6;
      const onY = Math.abs(y / EXT - Math.round(y / EXT)) < 1e-6;
      if (onX || onY) {

        const along = onX ? y : x;
        const line = onX ? `x${Math.round(x)}` : `y${Math.round(y)}`;
        const b = Math.round(along / 4);
        for (const bb of [b - 1, b, b + 1]) {
          const hit = (border.get(`${line}:${bb}`) || []).find((n) => Math.abs((onX ? ny[n] : nx[n]) - along) <= 4);
          if (hit != null) { ids.set(key, hit); return hit; }
        }
        id = nx.length;
        const bk = `${line}:${b}`;
        if (!border.has(bk)) border.set(bk, []);
        border.get(bk).push(id);
      } else id = nx.length;
      nx.push(x); ny.push(y);
      ids.set(key, id);
      return id;
    };

    const ea = [];
    const eb = [];
    const elen = [];
    const edir = [];
    const seen = new Set();
    for (const s of segs) {
      const pts = [[s.ax, s.ay], ...s.splits.sort((p, q) => p[0] - q[0]).map(([, x, y]) => [x, y]), [s.bx, s.by]];
      let prev = node(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) {
        const cur = node(pts[i][0], pts[i][1]);
        if (cur === prev) continue;
        const k = prev < cur ? `${prev}-${cur}` : `${cur}-${prev}`;
        if (!seen.has(k)) {
          seen.add(k);
          const len = Math.hypot(nx[cur] - nx[prev], ny[cur] - ny[prev]) * metersPerUnit((ny[cur] + ny[prev]) / 2);
          ea.push(prev); eb.push(cur); elen.push(len); edir.push(s.oneway);
        }
        prev = cur;
      }
    }
    const adj = Array.from({ length: nx.length }, () => []);
    for (let e = 0; e < ea.length; e += 1) { adj[ea[e]].push(e); adj[eb[e]].push(e); }
    Object.assign(this, { nx, ny, adj, ea, eb, elen, edir });

    const comp = new Int32Array(nx.length).fill(-1);
    const sizes = [];
    for (let s = 0; s < nx.length; s += 1) {
      if (comp[s] >= 0) continue;
      const c = sizes.length;
      let n = 0;
      const stack = [s];
      comp[s] = c;
      while (stack.length) {
        const u = stack.pop();
        n += 1;
        for (const e of adj[u]) {
          const v = ea[e] === u ? eb[e] : ea[e];
          if (comp[v] < 0) { comp[v] = c; stack.push(v); }
        }
      }
      sizes.push(n);
    }
    const best = sizes.indexOf(Math.max(...sizes, 0));
    this.#main = new Uint8Array(nx.length);
    for (let i = 0; i < nx.length; i += 1) this.#main[i] = comp[i] === best ? 1 : 0;

    this.#grid = new Map();
    for (let e = 0; e < ea.length; e += 1) {
      if (!this.#main[ea[e]]) continue;
      const a = ea[e];
      const b = eb[e];
      const x0 = Math.floor(Math.min(nx[a], nx[b]) / CELL);
      const x1 = Math.floor(Math.max(nx[a], nx[b]) / CELL);
      const y0 = Math.floor(Math.min(ny[a], ny[b]) / CELL);
      const y1 = Math.floor(Math.max(ny[a], ny[b]) / CELL);
      for (let gx = x0; gx <= x1; gx += 1) {
        for (let gy = y0; gy <= y1; gy += 1) {
          const k = `${gx},${gy}`;
          if (!this.#grid.has(k)) this.#grid.set(k, []);
          this.#grid.get(k).push(e);
        }
      }
    }
    this.#cache.clear();
    this.ready = ea.length > 0;
    this.emit('change');
  }

  #repair(segs) {
    const grid = new Map();
    const C = 64;
    segs.forEach((s, i) => {
      for (let gx = Math.floor(Math.min(s.ax, s.bx) / C); gx <= Math.floor(Math.max(s.ax, s.bx) / C); gx += 1) {
        for (let gy = Math.floor(Math.min(s.ay, s.by) / C); gy <= Math.floor(Math.max(s.ay, s.by) / C); gy += 1) {
          const k = `${gx},${gy}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(i);
        }
      }
    });
    const EPS = 1e-6;
    const done = new Set();
    for (const list of grid.values()) {
      for (let p = 0; p < list.length; p += 1) {
        for (let q = p + 1; q < list.length; q += 1) {
          const i = list[p];
          const j = list[q];
          const s = segs[i];
          const t = segs[j];
          if (s.level !== t.level) continue;
          const key = i < j ? i * 1e7 + j : j * 1e7 + i;
          if (done.has(key)) continue;
          done.add(key);

          const rx = s.bx - s.ax;
          const ry = s.by - s.ay;
          const sx = t.bx - t.ax;
          const sy = t.by - t.ay;
          const den = rx * sy - ry * sx;
          if (Math.abs(den) > EPS) {
            const u = ((t.ax - s.ax) * sy - (t.ay - s.ay) * sx) / den;
            const v = ((t.ax - s.ax) * ry - (t.ay - s.ay) * rx) / den;
            if (u > 0.001 && u < 0.999 && v > 0.001 && v < 0.999) {
              const x = s.ax + rx * u;
              const y = s.ay + ry * u;
              s.splits.push([u, x, y]);
              t.splits.push([v, x, y]);
              continue;
            }
          }

          touch(s, t);
          touch(t, s);
        }
      }
    }
  }

  snap(lat, lng, maxM = 3000) {
    if (!this.ready) return null;
    const [X, Y] = toXY(lat, lng);
    const mpu = metersPerUnit(Y);
    const gx = Math.floor(X / CELL);
    const gy = Math.floor(Y / CELL);
    const maxRing = Math.ceil(maxM / mpu / CELL) + 1;
    let best = null;
    for (let ring = 0; ring <= maxRing; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          for (const e of this.#grid.get(`${gx + dx},${gy + dy}`) || []) {
            const a = this.ea[e];
            const b = this.eb[e];
            const ax = this.nx[a];
            const ay = this.ny[a];
            const vx = this.nx[b] - ax;
            const vy = this.ny[b] - ay;
            const t = Math.max(0, Math.min(1, ((X - ax) * vx + (Y - ay) * vy) / (vx * vx + vy * vy || 1)));
            const px = ax + vx * t;
            const py = ay + vy * t;
            const d = Math.hypot(px - X, py - Y);
            if (!best || d < best.d) best = { e, t, x: px, y: py, d };
          }
        }
      }

      if (best && best.d <= ring * CELL) break;
    }
    if (!best || best.d * mpu > maxM) return null;
    const [plat, plng] = toLatLng(best.x, best.y);
    return { lat: plat, lng: plng, e: best.e, t: best.t, x: best.x, y: best.y, offM: best.d * mpu };
  }

  route(from, to) {
    const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    const hit = this.#cache.get(key);
    if (hit) return hit;
    let res = null;
    const a = this.snap(from.lat, from.lng);
    const b = this.snap(to.lat, to.lng);
    if (a && b) res = this.#astar(a, b, true) || this.#astar(a, b, false);
    if (!res) res = straight(from, to);
    if (this.#cache.size > 600) this.#cache.delete(this.#cache.keys().next().value);
    this.#cache.set(key, res);
    return res;
  }

  randomNear(lat, lng, minM, maxM, tries = 12) {
    for (let i = 0; i < tries; i += 1) {
      const dist = minM + Math.random() * (maxM - minM);
      const ang = Math.random() * Math.PI * 2;
      const dLat = (dist * Math.cos(ang)) / 111320;
      const dLng = (dist * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180));
      const s = this.snap(lat + dLat, lng + dLng, 400);
      if (s) {
        const d = haversine(lat, lng, s.lat, s.lng);
        if (d >= minM * 0.8 && d <= maxM * 1.2) return { lat: s.lat, lng: s.lng };
      }
    }
    return null;
  }

  #astar(a, b, respectOneway) {
    const { nx, ny, adj, ea, eb, elen, edir } = this;
    const can = (e, from) => !respectOneway || edir[e] === 0 || (edir[e] === 1 ? ea[e] === from : eb[e] === from);

    const mpuH = Math.min(metersPerUnit(a.y), metersPerUnit(b.y)) * 0.98;
    const h = (n) => Math.hypot(nx[n] - b.x, ny[n] - b.y) * mpuH;
    const pts = (list) => {
      let acc = 0;
      const out = [];
      let prev = null;
      for (const [x, y] of list) {
        const [lat, lng] = toLatLng(x, y);
        if (prev) acc += haversine(prev[0], prev[1], lat, lng);
        if (!prev || lat !== prev[0] || lng !== prev[1]) out.push([lat, lng, acc]);
        prev = [lat, lng];
      }
      return out;
    };

    if (a.e === b.e) {
      const forward = b.t >= a.t;
      const from = forward ? ea[a.e] : eb[a.e];
      if (can(a.e, from)) {
        const p = pts([[a.x, a.y], [b.x, b.y]]);
        return { pts: p, lengthM: p[p.length - 1][2], road: true };
      }
    }

    const g = new Map();
    const prev = new Map();
    const open = new Heap();
    const start = (n, cost) => { if (cost < (g.get(n) ?? Infinity)) { g.set(n, cost); prev.set(n, -1); open.push(cost + h(n), n); } };
    if (can(a.e, ea[a.e])) start(eb[a.e], (1 - a.t) * elen[a.e]);
    if (can(a.e, eb[a.e])) start(ea[a.e], a.t * elen[a.e]);

    const goal = new Map();
    if (can(b.e, ea[b.e])) goal.set(ea[b.e], b.t * elen[b.e]);
    if (can(b.e, eb[b.e])) goal.set(eb[b.e], (1 - b.t) * elen[b.e]);
    let bestCost = Infinity;
    let bestNode = -1;
    const closed = new Set();
    while (open.size) {
      const u = open.pop();
      if (closed.has(u)) continue;
      closed.add(u);
      const gu = g.get(u);
      if (gu + h(u) >= bestCost) break;
      if (goal.has(u) && gu + goal.get(u) < bestCost) { bestCost = gu + goal.get(u); bestNode = u; }
      for (const e of adj[u]) {
        if (!can(e, u)) continue;
        const v = ea[e] === u ? eb[e] : ea[e];
        const c = gu + elen[e];
        if (c < (g.get(v) ?? Infinity)) { g.set(v, c); prev.set(v, u); open.push(c + h(v), v); }
      }
    }
    if (bestNode < 0) return null;
    const chain = [];
    for (let n = bestNode; n !== -1; n = prev.get(n)) chain.push([nx[n], ny[n]]);
    chain.reverse();
    const p = pts([[a.x, a.y], ...chain, [b.x, b.y]]);
    return { pts: p, lengthM: p[p.length - 1][2], road: true };
  }
}

function touch(s, t) {
  const vx = t.bx - t.ax;
  const vy = t.by - t.ay;
  const len2 = vx * vx + vy * vy;
  if (!len2) return;
  for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {
    const u = ((x - t.ax) * vx + (y - t.ay) * vy) / len2;
    if (u <= 0.001 || u >= 0.999) continue;
    if (Math.hypot(t.ax + vx * u - x, t.ay + vy * u - y) <= 1.5) t.splits.push([u, x, y]);
  }
}

function straight(from, to) {
  const len = haversine(from.lat, from.lng, to.lat, to.lng);
  return { pts: [[from.lat, from.lng, 0], [to.lat, to.lng, len]], lengthM: len, road: false };
}

async function fetchTile(url) {
  const res = await fetch(url);
  if (res.status === 204 || res.status === 404) return new Uint8Array(0);
  if (!res.ok) throw new Error(`tile ${res.status}`);
  let buf = new Uint8Array(await res.arrayBuffer());

  if (buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    buf = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return buf;
}

export const roads = new RoadNet();
