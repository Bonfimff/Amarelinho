export const normalize = (value = '') =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const SAFE = Symbol('safe-html');

export function raw(value) {
  const s = new String(value ?? '');
  s[SAFE] = true;
  return s;
}

export function html(strings, ...values) {
  const out = strings.reduce((acc, str, i) => {
    if (i >= values.length) return acc + str;
    const v = values[i];
    return acc + str + (Array.isArray(v) ? v.map(asHtml).join('') : asHtml(v));
  }, '');
  return raw(out);
}

function asHtml(v) {
  if (v && v[SAFE]) return String(v);
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}
