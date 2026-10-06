class Reader {
  constructor(buf) { this.buf = buf; this.pos = 0; }

  varint() {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = this.buf[this.pos++];

      result += shift < 28 ? (b & 0x7f) << shift : (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b >= 0x80);
    return result;
  }

  int64() {
    let n = 0n;
    let shift = 0n;
    let b;
    do {
      b = this.buf[this.pos++];
      n |= BigInt(b & 0x7f) << shift;
      shift += 7n;
    } while (b >= 0x80);
    return Number(BigInt.asIntN(64, n));
  }

  svarint() { const n = this.varint(); return n % 2 === 1 ? (n + 1) / -2 : n / 2; }

  bytes() { const len = this.varint(); const start = this.pos; this.pos += len; return this.buf.subarray(start, this.pos); }

  string() { return new TextDecoder().decode(this.bytes()); }

  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`MVT: tipo de campo desconhecido ${wire}`);
  }

  fields(end, fn) {
    while (this.pos < end) {
      const key = this.varint();
      const before = this.pos;
      fn(key >> 3, key & 7);
      if (this.pos === before) this.skip(key & 7);
    }
  }
}

function readValue(r) {
  const end = r.varint() + r.pos;
  let v = null;
  r.fields(end, (f, wire) => {
    if (f === 1) v = r.string();
    else if (f === 2) { v = new DataView(r.buf.buffer, r.buf.byteOffset + r.pos, 4).getFloat32(0, true); r.pos += 4; }
    else if (f === 3) { v = new DataView(r.buf.buffer, r.buf.byteOffset + r.pos, 8).getFloat64(0, true); r.pos += 8; }
    else if (f === 5) v = r.varint();

    else if (f === 4) v = r.int64();
    else if (f === 6) v = r.svarint();
    else if (f === 7) v = Boolean(r.varint());
    else r.skip(wire);
  });
  return v;
}

function decodeGeometry(cmds) {
  const lines = [];
  let line = null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < cmds.length;) {
    const c = cmds[i++];
    const id = c & 7;
    const count = c >> 3;
    if (id === 7) { if (line && line.length) line.push(line[0]); continue; }
    for (let k = 0; k < count; k += 1) {
      const dx = cmds[i++];
      const dy = cmds[i++];
      x += dx % 2 === 1 ? (dx + 1) / -2 : dx / 2;
      y += dy % 2 === 1 ? (dy + 1) / -2 : dy / 2;
      if (id === 1) { line = [[x, y]]; lines.push(line); } else line.push([x, y]);
    }
  }
  return lines;
}

function readLayer(r, end) {
  const layer = { name: '', extent: 4096, keys: [], values: [], raw: [] };
  r.fields(end, (f) => {
    if (f === 1) layer.name = r.string();
    else if (f === 2) layer.raw.push(r.bytes());
    else if (f === 3) layer.keys.push(r.string());
    else if (f === 4) layer.values.push(readValue(r));
    else if (f === 5) layer.extent = r.varint();
  });
  return layer;
}

function readFeature(bytes, layer) {
  const r = new Reader(bytes);
  const feat = { type: 0, props: {}, geometry: [] };
  let tags = [];
  let cmds = [];
  r.fields(bytes.length, (f, wire) => {
    if (f === 2 || f === 4) {
      const end = r.varint() + r.pos;
      const out = [];
      while (r.pos < end) out.push(r.varint());
      if (f === 2) tags = out; else cmds = out;
    } else if (f === 3) feat.type = r.varint();
    else r.skip(wire);
  });
  for (let i = 0; i < tags.length; i += 2) feat.props[layer.keys[tags[i]]] = layer.values[tags[i + 1]];
  feat.geometry = decodeGeometry(cmds);
  return feat;
}

export function decodeTile(buffer, only = null) {
  const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const r = new Reader(buf);
  const out = {};
  r.fields(buf.length, (f, wire) => {
    if (f !== 3) { r.skip(wire); return; }
    const end = r.varint() + r.pos;
    const layer = readLayer(r, end);
    r.pos = end;
    if (only && !only.includes(layer.name)) return;
    out[layer.name] = { extent: layer.extent, features: layer.raw.map((b) => readFeature(b, layer)) };
  });
  return out;
}
