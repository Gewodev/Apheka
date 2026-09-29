// Genera iconos PNG de OWA Ventanas (cuadrado oscuro redondeado + punto rose) sin dependencias
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// dibuja en un buffer RGBA: fondo #0b0c0f con esquinas redondeadas + anillo/punto #E11D48
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.22;           // radio de esquinas
  const cx = size / 2, cy = size / 2;
  const dotR = size * 0.20;        // radio del punto central
  const ringW = size * 0.055;      // grosor de anillo
  const ringR = size * 0.30;       // radio del anillo
  const rr = (x, y, rad) => {
    const dx = Math.max(Math.abs(x - cx) - (size / 2 - r), 0);
    const dy = Math.max(Math.abs(y - cy) - (size / 2 - r), 0);
    return Math.sqrt(dx * dx + dy * dy) <= 0.5;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = rr(x + 0.5, y + 0.5);
      if (!inside) continue; // transparente fuera
      // fondo
      let R = 0x0b, G = 0x0c, B = 0x0f, A = 255;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const ringDist = Math.abs(d - ringR);
      if (ringDist <= ringW) {
        // anillo rose con suavizado
        const alpha = Math.max(0, 1 - ringDist / ringW);
        R = Math.round(0x0b + (0xe1 - 0x0b) * alpha);
        G = Math.round(0x0c + (0x1d - 0x0c) * alpha);
        B = Math.round(0x0f + (0x48 - 0x0f) * alpha);
      }
      if (d <= dotR) {
        // punto central sólido
        R = 0xe1; G = 0x1d; B = 0x48;
      }
      px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = A;
    }
  }
  return px;
}

function makePng(size) {
  const px = drawIcon(size);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro none
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [16, 32, 48, 128]) {
  fs.writeFileSync('D:/VIBE/Owa_Studio/extension/icons/icon' + s + '.png', makePng(s));
}
console.log('iconos generados: 16/32/48/128');
