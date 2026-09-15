// Ícones SVG inline (traço, 24x24). Decorativos por padrão: aria-hidden.
const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

/** Amarelinho colorido (frente do micro-ônibus): corpo amarelo, letreiro, para-brisa escuro e o coração de Magé. */
export const amarelinho = (cls = '') => `<svg class="bus-art ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <rect x="3" y="13" width="5" height="9" rx="2" fill="#14213D"/><rect x="40" y="13" width="5" height="9" rx="2" fill="#14213D"/>
  <path d="M7 10.5C7 6.4 10.2 4 14 4h20c3.8 0 7 2.4 7 6.5V37a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3Z" fill="#FFD100" stroke="#14337E" stroke-width="2"/>
  <rect x="12.5" y="7" width="23" height="4" rx="1.2" fill="#14213D"/><rect x="16" y="8.4" width="16" height="1.2" rx=".6" fill="#FFB300"/>
  <path d="M10.5 14.5c0-1.1.9-2 2-2h23c1.1 0 2 .9 2 2V25a1.5 1.5 0 0 1-1.5 1.5h-24A1.5 1.5 0 0 1 10.5 25Z" fill="#1E2A3D"/>
  <path d="M13 24.5 22 13h4.5l-9 11.5Z" fill="#fff" opacity=".14"/>
  <rect x="21.4" y="19.6" width="5.2" height="5.2" rx="1" fill="#2E66DB"/><path d="M24 20.6v2.2h1.6M23.1 22.9a1.3 1.3 0 1 0 2.2 1" fill="none" stroke="#fff" stroke-width=".7" stroke-linecap="round"/>
  <path d="M24 34.4c-2.6-1.6-4-3-4-4.6a2 2 0 0 1 4-.7 2 2 0 0 1 4 .7c0 1.6-1.4 3-4 4.6Z" fill="#E3342B"/><path d="M24 33c-1.5-1-2.3-1.8-2.3-2.8a1.1 1.1 0 0 1 2.3-.4 1.1 1.1 0 0 1 2.3.4c0 1-.8 1.8-2.3 2.8Z" fill="#2152C4"/><circle cx="24" cy="30.6" r=".9" fill="#3DA83A"/>
  <ellipse cx="13.5" cy="31" rx="2.6" ry="1.8" fill="#fff" stroke="#14337E" stroke-width=".8"/><ellipse cx="34.5" cy="31" rx="2.6" ry="1.8" fill="#fff" stroke="#14337E" stroke-width=".8"/>
  <rect x="9" y="35.2" width="30" height="3.4" rx="1.4" fill="#C9CFDA" stroke="#14337E" stroke-width=".8"/>
  <rect x="11" y="39.5" width="6" height="5" rx="1.4" fill="#14213D"/><rect x="31" y="39.5" width="6" height="5" rx="1.4" fill="#14213D"/>
</svg>`;

// ---------------------------------------------------------------------------------------------
// Amarelinho em perspectiva isométrica (faces superior, lateral e frontal/traseira visíveis).
// Eixos: x = comprimento (frente em x = L), y = largura, z = altura.
// Projeção isométrica: u = (x - y)·cos30°, v = (x + y)·sen30° - z.
// Variante 'front' mostra a frente (ônibus indo para baixo na tela); 'rear' mostra a traseira (indo para cima).
// Espelhando horizontalmente, cobre as quatro diagonais.
// ---------------------------------------------------------------------------------------------
const ISO = { L: 46, W: 15, H: 19 };
const C30 = Math.cos(Math.PI / 6);
const iso = (x, y, z) => [(x - y) * C30, (x + y) * 0.5 - z];
const pts = (list) => list.map(([x, y, z]) => iso(x, y, z).map((n) => n.toFixed(2)).join(',')).join(' ');
const poly = (list, attrs) => `<polygon points="${pts(list)}" ${attrs}/>`;
const sideRect = (x0, x1, z0, z1, attrs) => poly([[x0, ISO.W, z0], [x1, ISO.W, z0], [x1, ISO.W, z1], [x0, ISO.W, z1]], attrs);
const endRect = (y0, y1, z0, z1, attrs) => poly([[ISO.L, y0, z0], [ISO.L, y1, z0], [ISO.L, y1, z1], [ISO.L, y0, z1]], attrs);
const topRect = (x0, x1, y0, y1, attrs) => poly([[x0, y0, ISO.H], [x1, y0, ISO.H], [x1, y1, ISO.H], [x0, y1, ISO.H]], attrs);
const sideCircle = (xc, zc, r, attrs) => poly(Array.from({ length: 18 }, (_, i) => {
  const t = (i / 18) * Math.PI * 2;
  return [xc + r * Math.cos(t), ISO.W, zc + r * Math.sin(t)];
}), attrs);

function buildIsoBus(variant) {
  const { L, W, H } = ISO;
  const front = variant === 'front';
  const line = 'stroke="#14337E" stroke-width="0.9" stroke-linejoin="round"';
  const parts = [];
  // sombra no chão
  parts.push(poly([[-2, -1, 0], [L + 3, -1, 0], [L + 3, W + 3, 0], [-2, W + 3, 0]], 'fill="#0A163C" opacity=".18"'));
  // caixa
  parts.push(poly([[0, W, 0], [L, W, 0], [L, W, H], [0, W, H]], `fill="#FFD100" ${line}`));
  parts.push(poly([[L, 0, 0], [L, W, 0], [L, W, H], [L, 0, H]], `fill="#E8B600" ${line}`));
  parts.push(poly([[0, 0, H], [L, 0, H], [L, W, H], [0, W, H]], `fill="#FFE45C" ${line}`));
  // teto: ar-condicionado e faixa azul
  parts.push(topRect(17, 29, 3.5, 11.5, 'fill="#F3F5F9" stroke="#B7C0CE" stroke-width=".6"'));
  parts.push(topRect(front ? L - 7 : 3, front ? L - 3 : 7, 2, W - 2, 'fill="#2152C4" opacity=".85"'));
  // lateral: janelas, porta, coração, "tarifa zero", rodas
  const doorX = front ? L - 11.5 : 4;
  parts.push(sideRect(front ? 3 : 10.5, front ? L - 13 : L - 3, 9.5, 16.5, 'fill="#1E2A3D"'));
  for (const x of front ? [11, 19, 27] : [18.5, 26.5, 34.5]) parts.push(sideRect(x, x + 0.7, 9.5, 16.5, 'fill="#FFD100"'));
  parts.push(sideRect(doorX, doorX + 5.5, 1.2, 16.8, 'fill="#26324A" stroke="#14337E" stroke-width=".5"'));
  parts.push(sideRect(front ? 17 : 22, front ? 28 : 33, 5, 7.2, 'fill="#2152C4"'));
  const heartX = front ? 6 : L - 7;
  parts.push(sideCircle(heartX, 6.2, 4.4, 'fill="#E3342B"'));
  parts.push(sideCircle(heartX, 6.2, 3.3, 'fill="#2152C4"'));
  parts.push(sideCircle(heartX, 6.2, 2.2, 'fill="#3DA83A"'));
  parts.push(sideCircle(heartX, 6.2, 1.2, 'fill="#FFD100"'));
  parts.push(sideCircle(9, 1.4, 3.1, 'fill="#1B2230"'), sideCircle(9, 1.4, 1.3, 'fill="#8C95A6"'));
  parts.push(sideCircle(L - 10, 1.4, 3.1, 'fill="#1B2230"'), sideCircle(L - 10, 1.4, 1.3, 'fill="#8C95A6"'));
  // frente (para-brisa, letreiro, faróis) ou traseira (vidro, lanternas)
  if (front) {
    parts.push(endRect(1.2, W - 1.2, 8, 16.2, 'fill="#1E2A3D"'));
    parts.push(poly([[L, 2, 15.5], [L, 6, 15.5], [L, 3.5, 9], [L, 1.8, 9]], 'fill="#fff" opacity=".22"'));
    parts.push(endRect(2.5, W - 2.5, 16.8, 18.3, 'fill="#14213D"'));
    parts.push(endRect(4.5, W - 4.5, 17.3, 17.8, 'fill="#FFB300"'));
    parts.push(endRect(1.5, 4, 3.6, 5.4, 'fill="#FFF8D6"'), endRect(W - 4, W - 1.5, 3.6, 5.4, 'fill="#FFF8D6"'));
  } else {
    parts.push(endRect(2.5, W - 2.5, 10.5, 16, 'fill="#1E2A3D"'));
    parts.push(endRect(1.3, 3.3, 3.2, 6.5, 'fill="#E3342B"'), endRect(W - 3.3, W - 1.3, 3.2, 6.5, 'fill="#E3342B"'));
    parts.push(endRect(5.5, W - 5.5, 4, 6, 'fill="#F7F7F7" stroke="#14213D" stroke-width=".3"'));
  }
  parts.push(endRect(0.6, W - 0.6, 0.3, 2.2, 'fill="#B9C2D0" stroke="#14337E" stroke-width=".4"'));

  // viewBox centrado no centro da base do ônibus (para o marcador ficar sobre a coordenada)
  const [cu, cv] = iso(L / 2, W / 2, 0);
  const corners = [[-3, -2, 0], [L + 4, -2, 0], [L + 4, W + 4, 0], [-3, W + 4, 0], [0, 0, H + 1], [L, 0, H + 1], [0, W, H + 1], [L, W, H + 1]].map(([x, y, z]) => iso(x, y, z));
  const hw = Math.max(...corners.map(([u]) => Math.abs(u - cu))) + 1;
  const hh = Math.max(...corners.map(([, v]) => Math.abs(v - cv))) + 1;
  return `<svg class="bus-iso" viewBox="${(cu - hw).toFixed(1)} ${(cv - hh).toFixed(1)} ${(hw * 2).toFixed(1)} ${(hh * 2).toFixed(1)}" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

const ISO_CACHE = {};
/** @param {'front'|'rear'} variant */
export const amarelinhoIso = (variant = 'front') => (ISO_CACHE[variant] ??= buildIsoBus(variant));

/** Escolhe a variante isométrica para um rumo (0° = norte, sentido horário). */
export function isoOrientation(bearing) {
  const b = ((bearing % 360) + 360) % 360;
  // Na tela: frente visível andando para baixo (90°–270°); espelha quando o movimento é para a esquerda (180°–360°).
  const front = b >= 90 && b < 270;
  return { variant: front ? 'front' : 'rear', mirror: front ? b >= 180 : b < 90 };
}

export const icons = {
  // Micro-ônibus visto de frente (espelhos, letreiro, para-brisa, faróis e para-choque), no traço dos demais ícones.
  bus: (c) => svg('<path d="M6 20.5v1.5M18 20.5v1.5"/><path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h8a2.5 2.5 0 0 1 2.5 2.5v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2Z"/><path d="M5.5 7.5H3.5v3M18.5 7.5h2v3"/><path d="M8.5 5.5h7"/><path d="M7.5 8h9v5.5h-9Z"/><circle cx="8.6" cy="16.8" r=".9" fill="currentColor" stroke="none"/><circle cx="15.4" cy="16.8" r=".9" fill="currentColor" stroke="none"/>', c),
  home: (c) => svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>', c),
  live: (c) => svg('<circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>', c),
  lines: (c) => svg('<path d="M6 4v16M6 8h8a4 4 0 0 1 0 8H9"/><circle cx="6" cy="4" r="1.6"/><circle cx="6" cy="20" r="1.6"/>', c),
  search: (c) => svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', c),
  info: (c) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>', c),
  pin: (c) => svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>', c),
  clock: (c) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>', c),
  route: (c) => svg('<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.6"/>', c),
  play: (c) => svg('<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.4-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7Z" fill="currentColor" stroke="none"/>', c),
  pause: (c) => svg('<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>', c),
  restart: (c) => svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V8H8"/>', c),
  chevronRight: (c) => svg('<path d="m9 5 7 7-7 7"/>', c),
  chevronDown: (c) => svg('<path d="m5 9 7 7 7-7"/>', c),
  arrowLeft: (c) => svg('<path d="M19 12H5M11 5l-7 7 7 7"/>', c),
  arrowRight: (c) => svg('<path d="M5 12h14M13 5l7 7-7 7"/>', c),
  arrowDown: (c) => svg('<path d="M12 5v14M5 13l7 7 7-7"/>', c),
  swap: (c) => svg('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', c),
  locate: (c) => svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7"/>', c),
  target: (c) => svg('<path d="M3 11 21 3l-8 18-2-8-8-2Z"/>', c),
  alert: (c) => svg('<path d="M12 3.5 2.8 19.5h18.4Z"/><path d="M12 10v4.2M12 17v.1"/>', c),
  external: (c) => svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', c),
  check: (c) => svg('<path d="m5 12.5 4.5 4.5L19 7"/>', c),
  calendar: (c) => svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', c),
  shield: (c) => svg('<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>', c),
  close: (c) => svg('<path d="M6 6l12 12M18 6 6 18"/>', c)
};
