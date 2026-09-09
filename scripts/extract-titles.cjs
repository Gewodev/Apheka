// Extrae el mapeo archivo→título real desde el IndexedDB (leveldb) de OWA Studio.
const fs = require('fs');
const p = 'C:/Users/USER/AppData/Local/com.owa.studio/EBWebView/Default/IndexedDB/http_localhost_1420.indexeddb.leveldb/000744.log';
const fd = fs.openSync(p, 'r');
const buf = Buffer.alloc(fs.fstatSync(fd).size);
fs.readSync(fd, buf, 0, buf.length, 0);
fs.closeSync(fd);

function readStringAt(i) {
  const tag = buf[i];
  if (tag !== 0x22 && tag !== 0x63) return null;
  let len = 0, shift = 0, j = i + 1;
  while (true) {
    const b = buf[j]; j++;
    len |= (b & 0x7f) << shift;
    if (b < 0x80) break;
    shift += 7;
    if (shift > 28) return null;
  }
  if (j + (tag === 0x63 ? len * 2 : len) > buf.length) return null;
  if (tag === 0x22) return { s: buf.slice(j, j + len).toString('latin1'), next: j + len };
  return { s: buf.slice(j, j + len * 2).swap16().toString('utf16le'), next: j + len * 2 };
}

const map = {};
const keyTitle = Buffer.from('title');
let i = 0;
while (true) {
  i = buf.indexOf(keyTitle, i);
  if (i === -1) break;
  const tv = readStringAt(i + 5);
  i += 5;
  if (!tv || !tv.s || ['title', 'url', 'artist', 'source', 'duration', 'coverImage', 'id', 'local'].includes(tv.s)) continue;
  let pos = tv.next, urlVal = null;
  for (let k = 0; k < 10; k++) {
    const kv = readStringAt(pos);
    if (!kv) break;
    if (kv.s === 'url') {
      const v = readStringAt(kv.next);
      if (v) urlVal = v.s;
      break;
    }
    const vv = readStringAt(kv.next);
    if (vv) pos = vv.next;
    else {
      let q = kv.next;
      while (q < kv.next + 8 && buf[q] !== 0x22 && buf[q] !== 0x63) q++;
      pos = q;
    }
  }
  if (!urlVal) continue;
  const clean = urlVal.split(/[\\/]+/).join('/').toLowerCase();
  const idx = clean.lastIndexOf('/music/');
  if (idx === -1) continue;
  const file = clean.slice(idx + 7);
  if (file.endsWith('.mp3') && !map[file]) map[file] = tv.s;
}

const files = fs.readdirSync('C:/Users/USER/AppData/Roaming/com.owa.studio/music');
let matched = 0; const missing = [];
for (const f of files) { if (map[f]) matched++; else missing.push(f); }
console.log('total archivos:', files.length, '| con titulo real:', matched, '| sin titulo:', missing.length);
console.log('MUESTRA:');
Object.entries(map).slice(0, 12).forEach(([f, ti]) => console.log('  ', f.slice(0, 10) + '...', '=>', ti.slice(0, 65)));
fs.writeFileSync('D:/VIBE/Owa_Studio/scripts/music-title-map.json', JSON.stringify(map, null, 1));
if (missing.length) fs.writeFileSync('D:/VIBE/Owa_Studio/scripts/music-missing.json', JSON.stringify(missing, null, 1));
console.log('mapa guardado en scripts/music-title-map.json');
