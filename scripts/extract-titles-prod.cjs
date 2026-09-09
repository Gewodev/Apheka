// Extrae títulos de las 290 pistas descargadas desde la base de producción (tauri.localhost)
const fs = require('fs');
const dir = 'C:/Users/USER/AppData/Local/com.owa.studio/EBWebView/Default/IndexedDB/http_tauri.localhost_0.indexeddb.leveldb';
const MUSIC = 'C:/Users/USER/AppData/Roaming/com.owa.studio/music';

const disk = fs.readdirSync(MUSIC).filter(f => f.endsWith('.mp3'));
const bufFiles = fs.readdirSync(dir).filter(f => /^\d+(\.log|\.ldb)$/.test(f));
const bufs = bufFiles.map(f => {
  const fd = fs.openSync(dir + '/' + f, 'r');
  const b = Buffer.alloc(fs.fstatSync(fd).size);
  fs.readSync(fd, b, 0, b.length, 0);
  fs.closeSync(fd);
  return b;
});
const all = Buffer.concat(bufs);
console.log('bytes de la base producción:', all.length);

// Para cada archivo de disco: buscar el UUID en toda la base y extraer el 'title' cercano
const map = {};
const noTitle = [];
for (const f of disk) {
  const uuid = f.replace(/\.mp3$/i, '');
  const ub = Buffer.from(uuid);
  let i = all.indexOf(ub), found = null;
  while (i !== -1 && !found) {
    // buscar 'title' seguido de su valor dentro de ±4KB alrededor del uuid
    const from = Math.max(0, i - 4096);
    const to = Math.min(all.length, i + 4096);
    const seg = all.slice(from, to);
    let k = 0;
    while (true) {
      k = seg.indexOf(Buffer.from('title'), k);
      if (k === -1) break;
      // valor: tag (0x22/0x63) + varint len + chars, justo tras 'title'
      const vi = k + 5;
      const tag = seg[vi];
      if (tag === 0x22 || tag === 0x63) {
        let len = 0, shift = 0, j = vi + 1;
        while (true) {
          const b = seg[j]; j++;
          len |= (b & 0x7f) << shift;
          if (b < 0x80) break;
          shift += 7;
          if (shift > 24) break;
        }
        const end = j + (tag === 0x63 ? len * 2 : len);
        if (end <= seg.length && len > 0 && len < 500) {
          const s = tag === 0x22
            ? seg.slice(j, end).toString('latin1')
            : seg.slice(j, end).swap16().toString('utf16le');
          // descartar nombres de campos/otros ids
          if (!['url', 'artist', 'source', 'duration', 'id', 'file', 'local', 'title'].includes(s) && /[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]/.test(s)) {
            found = s; break;
          }
        }
      }
      k += 5;
    }
    i = all.indexOf(ub, i + 1);
  }
  if (found) map[f] = found; else noTitle.push(f);
}

console.log('pistas con titulo:', Object.keys(map).length, '| sin titulo:', noTitle.length);
if (noTitle.length) console.log('sin titulo:', noTitle.slice(0, 5));
const entries = Object.entries(map);
console.log('MUESTRA (12):');
entries.slice(0, 12).forEach(([f, ti]) => console.log('  ', f.slice(0, 10) + '...', '=>', ti.slice(0, 60)));
fs.writeFileSync('D:/VIBE/Owa_Studio/scripts/music-title-map-prod.json', JSON.stringify(map, null, 1));
console.log('guardado: scripts/music-title-map-prod.json');
