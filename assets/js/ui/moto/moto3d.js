const ELEV = (58 * Math.PI) / 180;
const SIN_E = Math.sin(ELEV);
const COS_E = Math.cos(ELEV);
const TO_CAM = [0, -COS_E, SIN_E];
const LIGHT = (() => { const v = [-0.45, 0.35, 0.82]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
const STEP = 7.5;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((c) => c / n); };
const mid = (pts) => pts.reduce((m, p) => [m[0] + p[0] / pts.length, m[1] + p[1] / pts.length, m[2] + p[2] / pts.length], [0, 0, 0]);

function box(x0, x1, y0, y1, z0, z1, color, taper = 0) {

  const t = taper;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0 + t, z1], [x1, y0 + t, z1], [x1, y1 - t, z1], [x0, y1 - t, z1]
  ];
  const f = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return { color, faces: f.map((idx) => idx.map((i) => v[i])) };
}

function beam(p0, p1, w, h, color) {
  const axis = norm(sub(p1, p0));
  const ref = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(axis, ref));
  const v = norm(cross(axis, u));
  const corners = (p) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [
    p[0] + u[0] * a * w / 2 + v[0] * b * h / 2,
    p[1] + u[1] * a * w / 2 + v[1] * b * h / 2,
    p[2] + u[2] * a * w / 2 + v[2] * b * h / 2
  ]);
  const A = corners(p0);
  const B = corners(p1);
  const faces = [A.slice().reverse(), B];
  for (let i = 0; i < 4; i += 1) faces.push([A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]]);
  return { color, faces };
}

function wheel(cx, cz, r, w, color = '#1D222B', hub = '#AEB6C2') {
  const n = 14;
  const ring = (y) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  });
  const L = ring(w / 2);
  const R = ring(-w / 2);
  const faces = [L, R.slice().reverse()];
  for (let i = 0; i < n; i += 1) faces.push([L[i], L[(i + 1) % n], R[(i + 1) % n], R[i]]);
  const tire = { color, faces };

  const hubRing = (y) => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return [cx + r * 0.45 * Math.cos(a), y, cz + r * 0.45 * Math.sin(a)];
  });
  return [tire, { color: hub, faces: [hubRing(w / 2 + 0.05)], flat: [0, 1, 0] }, { color: hub, faces: [hubRing(-w / 2 - 0.05)], flat: [0, -1, 0] }];
}

function ball(c, r, color, visor = null) {
  const rows = 5;
  const cols = 10;
  const p = (i, j) => {
    const th = (i / rows) * Math.PI;
    const ph = (j / cols) * Math.PI * 2;
    return [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * Math.cos(th)];
  };
  const shell = { color, faces: [] };
  const glass = { color: visor, faces: [] };
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const quad = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
      const m = mid(quad);
      const front = visor && i >= 2 && i <= 2 && (m[0] - c[0]) > r * 0.45;
      (front ? glass : shell).faces.push(quad);
    }
  }
  return visor ? [shell, { ...glass, center: c }] : [shell];
}

function model(body, carrying) {
  const parts = [];
  const add = (p) => { (Array.isArray(p) ? p : [p]).forEach((x) => parts.push(x)); };
  const dark = '#2A303B';
  const metal = '#6B7483';
  const chrome = '#C9CFD8';

  add(wheel(-6.4, 3.1, 3.1, 1.5));
  add(wheel(7.0, 3.1, 3.1, 1.25));

  add(box(-6.4, -1.2, -0.7, 0.7, 2.6, 3.7, dark));
  add(box(-2.2, 2.6, -1.6, 1.6, 2.0, 5.4, metal));
  add(box(-7.6, -0.5, -2.3, -1.5, 2.9, 3.8, chrome));

  add(box(-1.2, 4.2, -1.2, 1.2, 5.0, 6.8, body));
  add(box(0.6, 4.8, -2.0, 2.0, 6.4, 8.7, body, 0.55));
  add(box(-5.6, 0.9, -1.55, 1.55, 6.9, 8.2, '#20242C', 0.2));
  add(box(-8.3, -4.6, -1.25, 1.25, 6.3, 7.5, body, 0.2));
  add(box(-8.6, -8.1, -0.9, 0.9, 6.6, 7.3, '#E3342B'));

  add(beam([7.0, 1.0, 3.1], [5.0, 1.0, 9.6], 0.55, 0.55, chrome));
  add(beam([7.0, -1.0, 3.1], [5.0, -1.0, 9.6], 0.55, 0.55, chrome));
  add(box(5.6, 8.7, -0.95, 0.95, 6.1, 6.7, body));
  add(box(5.5, 6.6, -1.0, 1.0, 8.3, 9.7, '#FFF3B0'));
  add(beam([4.7, 3.3, 10.2], [4.7, -3.3, 10.2], 0.5, 0.5, dark));

  const jeans = '#2F4266';
  const vest = '#F07A1A';
  const skin = '#A86E4B';
  add(beam([-1.4, 1.5, 8.6], [2.6, 2.3, 8.1], 1.2, 1.3, jeans));
  add(beam([2.6, 2.3, 8.1], [1.4, 2.4, 4.0], 1.1, 1.1, jeans));
  add(beam([-1.4, -1.5, 8.6], [2.6, -2.3, 8.1], 1.2, 1.3, jeans));
  add(beam([2.6, -2.3, 8.1], [1.4, -2.4, 4.0], 1.1, 1.1, jeans));
  add(beam([-1.9, 0, 8.4], [0.1, 0, 13.9], 4.1, 2.5, vest));
  add(beam([0.2, 2.0, 13.2], [4.5, 3.0, 10.4], 0.9, 0.9, vest));
  add(beam([0.2, -2.0, 13.2], [4.5, -3.0, 10.4], 0.9, 0.9, vest));
  add(box(4.2, 4.9, 2.7, 3.4, 10.0, 10.7, skin));
  add(box(4.2, 4.9, -3.4, -2.7, 10.0, 10.7, skin));
  add(ball([0.5, 0, 15.6], 1.85, '#1E2A3D', '#7FA6D9'));
  if (carrying) {

    add(beam([-5.0, 1.4, 8.6], [-1.8, 2.4, 8.2], 1.1, 1.2, '#4B5563'));
    add(beam([-1.8, 2.4, 8.2], [-2.6, 2.5, 4.4], 1.0, 1.0, '#4B5563'));
    add(beam([-5.0, -1.4, 8.6], [-1.8, -2.4, 8.2], 1.1, 1.2, '#4B5563'));
    add(beam([-1.8, -2.4, 8.2], [-2.6, -2.5, 4.4], 1.0, 1.0, '#4B5563'));
    add(beam([-5.1, 0, 8.4], [-3.6, 0, 13.0], 3.6, 2.3, '#3A7BD5'));
    add(ball([-3.4, 0, 14.6], 1.75, '#F4F6FA', '#7FA6D9'));
  }
  return parts;
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const shade = (color, k) => {
  const [r, g, b] = hex(color);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

const yawFor = (bearing) => {
  const b = (bearing * Math.PI) / 180;
  return Math.atan2(Math.sin(b) * SIN_E, Math.cos(b));
};

function render(bearing, body, carrying) {
  const th = yawFor(bearing);
  const s = Math.sin(th);
  const c = Math.cos(th);

  const world = ([x, y, z]) => [x * s - y * c, x * c + y * s, z];
  const screen = ([X, Y, Z]) => [X, -(Y * SIN_E + Z * COS_E)];
  const depth = ([, Y, Z]) => Y * COS_E - Z * SIN_E;
  const fmt = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;

  const out = [];

  const shadow = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return screen(world([0.3 + 10.8 * Math.cos(a), 3.6 * Math.sin(a), 0]));
  });
  out.push(`<polygon points="${shadow.map(fmt).join(' ')}" fill="#0A163C" opacity=".22"/>`);

  const parts = model(body, carrying).map((p) => {
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
      const k = 0.62 + 0.5 * Math.max(0, dot(n, LIGHT));
      faces.push({ d: depth(mid(f)), pts: f.map(screen), fill: shade(p.color, k) });
    }
    faces.sort((a, b) => b.d - a.d);
    faces.forEach((f) => out.push(`<polygon points="${f.pts.map(fmt).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width=".25" stroke-linejoin="round"/>`));
  }
  return out.join('');
}

const BOX = (() => {
  let hw = 0;
  let top = 0;
  let bottom = 0;
  for (let b = 0; b < 360; b += 15) {
    const th = yawFor(b);
    const s = Math.sin(th);
    const c = Math.cos(th);
    for (const p of model('#000000', true)) {
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

export function moto3d(bearing = 90, body = '#3DA83A', carrying = false) {
  const b = headingStep(bearing);
  const key = `${b}|${body}|${carrying ? 1 : 0}`;
  let svg = CACHE.get(key);
  if (!svg) {
    svg = `<svg class="moto3d" viewBox="${-BOX.hw} ${BOX.top} ${BOX.hw * 2} ${BOX.bottom - BOX.top}" aria-hidden="true" focusable="false">${render(b, body, carrying)}</svg>`;
    CACHE.set(key, svg);
  }
  return svg;
}
