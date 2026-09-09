// Identifica las ~26 pistas restantes por coincidencia de bytes de AUDIO contra los .ldb/.log
// (las descargas duplicadas comparten bytes idénticos: mismo archivo, distinta entrada de DB)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MUSIC = 'C:/Users/USER/AppData/Roaming/com.owa.studio/music';

// 1) hash de los archivos ya renombrados (contenido completo)
const renamed = fs.readdirSync(MUSIC).filter(f => f.endsWith('.mp3') && !(f.length === 40 && f[8] === '-' && f[13] === '-'));
const hashToName = {};
for (const f of renamed) {
  const h = crypto.createHash('md5').update(fs.readFileSync(path.join(MUSIC, f))).digest('hex');
  hashToName[h] = f.replace(/\.mp3$/i, '');
}

// 2) las huérfanas (aún UUID)
const orphans = fs.readdirSync(MUSIC).filter(f => f.endsWith('.mp3') && f.length === 40 && f[8] === '-' && f[13] === '-');
console.log('huerfanas:', orphans.length, '| base de hashes:', Object.keys(hashToName).length);

const resolved = [], unresolved = [];
for (const f of orphans) {
  const h = crypto.createHash('md5').update(fs.readFileSync(path.join(MUSIC, f))).digest('hex');
  const match = hashToName[h];
  if (match) resolved.push({ f, match });
  else unresolved.push(f);
}
console.log('resueltas por audio identico (duplicados):', resolved.length, '| sin resolver:', unresolved.length);
resolved.slice(0, 6).forEach(r => console.log('  ', r.f.slice(0, 10) + '... == ', r.match));

// 3) renombrar duplicados como "Nombre (duplicado)"
let ok = 0;
for (const r of resolved) {
  let to = r.match + ' (duplicado).mp3';
  let n = 2;
  while (fs.existsSync(path.join(MUSIC, to))) { to = r.match + ' (duplicado ' + n + ').mp3'; n++; }
  fs.renameSync(path.join(MUSIC, r.f), path.join(MUSIC, to));
  ok++;
}
console.log('duplicados renombrados:', ok);
fs.writeFileSync('D:/VIBE/Owa_Studio/scripts/music-orphans.json', JSON.stringify({ resueltas: resolved, sin_resolver: unresolved }, null, 1));
console.log('pendientes sin resolver:', unresolved.map(f => f.slice(0, 8)).join(', '));
