const ELEV = (58 * Math.PI) / 180;
const SIN_E = Math.sin(ELEV);
const COS_E = Math.cos(ELEV);
const TO_CAM = [0, -COS_E, SIN_E];
const LIGHT = (() => { const v = [-0.4, 0.3, 0.86]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
const STEP = 7.5;

const PAINT = { vermelha: '#A8231C', preta: '#1E2126', azul: '#1F4C94', prata: '#A3AAB3', branca: '#E4E7EA', verde: '#2B6E47', amarela: '#D9A514', cinza: '#6B717A' };
export const paintFor = (color = '') => {
  const k = Object.keys(PAINT).find((name) => String(color).toLowerCase().includes(name.slice(0, 4)));
  return PAINT[k] || PAINT.vermelha;
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((c) => c / n); };
const mid = (pts) => pts.reduce((m, p) => [m[0] + p[0] / pts.length, m[1] + p[1] / pts.length, m[2] + p[2] / pts.length], [0, 0, 0]);

function box(x0, x1, y0, y1, z0, z1, color, { taper = 0, gloss = 0 } = {}) {
  const t = taper;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0 + t, z1], [x1, y0 + t, z1], [x1, y1 - t, z1], [x0, y1 - t, z1]
  ];
  const f = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return { color, gloss, faces: f.map((idx) => idx.map((i) => v[i])) };
}

function prism(p0, p1, rw, rh, color, { n = 8, gloss = 0, r1 = 1 } = {}) {
  const axis = norm(sub(p1, p0));
  const ref = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(axis, ref));
  const v = norm(cross(axis, u));
  const ring = (p, k) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const cu = Math.cos(a) * rw * k;
    const cv = Math.sin(a) * rh * k;
    return [p[0] + u[0] * cu + v[0] * cv, p[1] + u[1] * cu + v[1] * cv, p[2] + u[2] * cu + v[2] * cv];
  });
  const A = ring(p0, 1);
  const B = ring(p1, r1);
  const faces = [A.slice().reverse(), B];
  for (let i = 0; i < n; i += 1) faces.push([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]]);
  return { color, gloss, faces };
}

function wheel(cx, cz, r, w) {
  const out = [prism([cx, w / 2, cz], [cx, -w / 2, cz], r, r, '#1B1D21', { n: 20 })];
  const disc = (y, rr, color, gloss) => ({
    color, gloss, flat: [0, Math.sign(y), 0],
    faces: [Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [cx + rr * Math.cos(a), y, cz + rr * Math.sin(a)]; })]
  });
  for (const s of [1, -1]) {
    out.push(disc(s * (w / 2 + 0.02), r * 0.72, '#7D848E', 0.3));
    out.push(disc(s * (w / 2 + 0.05), r * 0.6, '#3A3E45', 0));
    out.push(disc(s * (w / 2 + 0.08), r * 0.2, '#C3C8CF', 0.4));
  }
  return out;
}

function model(paint) {
  const parts = [];
  const add = (p) => { (Array.isArray(p) ? p : [p]).forEach((x) => parts.push(x)); };
  const black = '#1C1E22';
  const metal = '#5E646D';
  const chrome = '#B9C0C8';

  add(wheel(-6.6, 3.0, 3.0, 1.1));
  add(wheel(6.6, 3.0, 3.0, 0.9));
  add(box(5.2, 7.9, -0.55, 0.55, 5.85, 6.25, paint, { gloss: 0.5 }));
  add(box(-9.0, -5.6, -0.8, 0.8, 6.0, 6.6, paint, { gloss: 0.5 }));
  add(box(-9.25, -8.95, -0.5, 0.5, 6.15, 6.75, '#B3261E', { gloss: 0.4 }));
  add(box(-8.6, -6.0, -0.75, 0.75, 7.55, 7.75, '#2A2C31'));

  add(prism([-6.6, 0.75, 3.0], [-1.4, 0.75, 3.8], 0.22, 0.28, black, { n: 6 }));
  add(prism([-6.6, -0.75, 3.0], [-1.4, -0.75, 3.8], 0.22, 0.28, black, { n: 6 }));
  add(box(-1.8, 2.2, -1.25, 1.25, 2.2, 4.6, metal, { gloss: 0.2 }));
  add(box(1.0, 2.7, -1.05, 1.05, 4.0, 5.7, '#767D87', { gloss: 0.2 }));
  add(prism([2.0, -0.9, 3.2], [-2.8, -1.55, 2.7], 0.24, 0.24, chrome, { gloss: 0.7 }));
  add(prism([-2.8, -1.6, 2.8], [-7.3, -1.7, 3.7], 0.48, 0.42, '#9AA2AB', { n: 10, gloss: 0.7, r1: 0.8 }));

  add(box(-3.8, -0.6, -1.05, 1.05, 4.8, 6.7, paint, { gloss: 0.4 }));
  add(box(-0.2, 4.4, -1.65, 1.65, 6.3, 8.25, paint, { taper: 0.55, gloss: 0.7 }));
  add(box(-6.3, 0.4, -1.3, 1.3, 6.95, 7.7, '#2A2B2F', { taper: 0.3, gloss: 0.15 }));

  add(prism([6.6, 0.85, 3.0], [4.9, 0.85, 9.0], 0.2, 0.2, chrome, { n: 6, gloss: 0.7 }));
  add(prism([6.6, -0.85, 3.0], [4.9, -0.85, 9.0], 0.2, 0.2, chrome, { n: 6, gloss: 0.7 }));
  add(prism([5.1, 0, 8.7], [5.9, 0, 8.7], 0.85, 0.85, black, { n: 12 }));
  add(prism([5.9, 0, 8.7], [6.0, 0, 8.7], 0.72, 0.72, '#F1EEDC', { n: 12, gloss: 0.8 }));
  add(box(4.3, 5.0, -0.6, 0.6, 9.3, 9.9, black));
  add(prism([4.6, 2.75, 10.0], [4.6, -2.75, 10.0], 0.16, 0.16, black, { n: 6 }));
  add(prism([4.6, 2.75, 10.0], [4.6, 1.95, 10.0], 0.24, 0.24, '#2A2B2F', { n: 6 }));
  add(prism([4.6, -2.75, 10.0], [4.6, -1.95, 10.0], 0.24, 0.24, '#2A2B2F', { n: 6 }));
  return parts;
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const shade = (color, k, spec) => {
  const [r, g, b] = hex(color);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k + (255 - v * k) * spec)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

const yawFor = (bearing) => {
  const b = (bearing * Math.PI) / 180;
  return Math.atan2(Math.sin(b) * SIN_E, Math.cos(b));
};

function render(bearing, paint, ring) {
  const th = yawFor(bearing);
  const s = Math.sin(th);
  const c = Math.cos(th);

  const world = ([x, y, z]) => [x * s - y * c, x * c + y * s, z];
  const screen = ([X, Y, Z]) => [X, -(Y * SIN_E + Z * COS_E)];
  const depth = ([, Y, Z]) => Y * COS_E - Z * SIN_E;
  const fmt = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const ground = (rx, ry, x0 = 0) => Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return screen(world([x0 + rx * Math.cos(a), ry * Math.sin(a), 0]));
  }).map(fmt).join(' ');

  const out = [];

  if (ring) out.push(`<polygon points="${ground(11.8, 4.6, -0.2)}" fill="${ring}" fill-opacity=".22" stroke="${ring}" stroke-width=".55" stroke-opacity=".85"/>`);
  out.push(`<polygon points="${ground(10.2, 3.2, -0.2)}" fill="#0A0F1C" opacity=".28"/>`);

  const parts = model(paint).map((p) => {
    const faces = p.faces.map((f) => f.map(world));
    const center = world(p.center || mid(p.faces.flat()));
    return { ...p, faces, center, depth: depth(center) };
  });
  parts.sort((a, b) => b.depth - a.depth);
  for (const p of parts) {
    const faces = [];
    for (const f of p.faces) {
      let n = norm(cross(sub(f[1], f[0]), sub(f[2], f[0])));
      if (dot(n, sub(mid(f), p.center)) < 0) n = n.map((v) => -v);
      if (p.flat) n = norm(world(p.flat));
      if (dot(n, TO_CAM) <= 0.02) continue;
      const diff = Math.max(0, dot(n, LIGHT));

      const refl = sub(n.map((v) => v * 2 * dot(n, LIGHT)), LIGHT);
      const spec = p.gloss ? p.gloss * Math.max(0, dot(refl, TO_CAM)) ** 14 * 0.55 : 0;
      faces.push({ d: depth(mid(f)), pts: f.map(screen), fill: shade(p.color, 0.5 + 0.58 * diff, spec) });
    }
    faces.sort((a, b) => b.d - a.d);
    faces.forEach((f) => out.push(`<polygon points="${f.pts.map(fmt).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width=".18" stroke-linejoin="round"/>`));
  }
  return out.join('');
}

const BOX = (() => {
  let hw = 12;
  let top = 0;
  let bottom = 5 * SIN_E;
  for (let b = 0; b < 360; b += 15) {
    const th = yawFor(b);
    const s = Math.sin(th);
    const c = Math.cos(th);
    for (const p of model('#000000')) {
      for (const f of p.faces) {
        for (const [x, y, z] of f) {
          const X = x * s - y * c;
          const Y = x * c + y * s;
          const v = -(Y * SIN_E + z * COS_E);
          hw = Math.max(hw, Math.abs(X));
          top = Math.min(top, v);
          bottom = Math.max(bottom, v);
        }
      }
    }
  }
  return { hw: Math.ceil(hw + 0.5), top: Math.floor(top - 0.5), bottom: Math.ceil(bottom + 0.5) };
})();

export const MOTO3D_BOX = { w: BOX.hw * 2, h: BOX.bottom - BOX.top, groundY: -BOX.top / (BOX.bottom - BOX.top) };

const CACHE = new Map();

export const headingStep = (bearing) => (Math.round((((bearing % 360) + 360) % 360) / STEP) * STEP) % 360;

export function moto3d(bearing = 90, { paint = PAINT.vermelha, ring = null } = {}) {
  const b = headingStep(bearing);
  const key = `${b}|${paint}|${ring}`;
  let svg = CACHE.get(key);
  if (!svg) {
    svg = `<svg class="moto3d" viewBox="${-BOX.hw} ${BOX.top} ${BOX.hw * 2} ${BOX.bottom - BOX.top}" aria-hidden="true" focusable="false">${render(b, paint, ring)}</svg>`;
    CACHE.set(key, svg);
  }
  return svg;
}
