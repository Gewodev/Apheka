// Renombra los mp3 con el nombre estético de la canción (sin artista, sin tags de video)
const fs = require('fs');
const path = require('path');
const MUSIC = 'C:/Users/USER/AppData/Roaming/com.owa.studio/music';
const map = JSON.parse(fs.readFileSync('D:/VIBE/Owa_Studio/scripts/music-title-map-prod.json'));

function cleanTitle(t) {
  let s = t.trim();
  // quitar tags de video/audio/letras en paréntesis o corchetes
  s = s.replace(/\s*[([]\s*(?:video|audio|letra|lyrics|lyric|official|oficial|visualizer|hd|4k|remaster(?:izada|ized)?|en vivo|live)[^)\]]*[)\]]/gi, '');
  // quitar prefijos tipo "Artista, Artista2 - " (todo antes del último ' - ')
  if (s.includes(' - ')) s = s.split(' - ').pop();
  // quitar residuos de pipes o corchetes de video
  s = s.replace(/^\s*[-–—|]\s*/, '');
  // caracteres inválidos para nombre de archivo
  s = s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\.+$/, '');
  return s;
}

const used = new Set();
const plan = [];
const noTitle = [];
for (const f of fs.readdirSync(MUSIC).filter(f => f.endsWith('.mp3'))) {
  const raw = map[f];
  if (!raw) { noTitle.push(f); continue; }
  let name = cleanTitle(raw);
  if (!name) { noTitle.push(f); continue; }
  // desambiguar duplicados
  let final = name, n = 2;
  while (used.has(final.toLowerCase())) { final = name + ' (' + n + ')'; n++; }
  used.add(final.toLowerCase());
  plan.push({ from: f, to: final + '.mp3', title: raw.trim() });
}
console.log('plan: ' + plan.length + ' renombres | ' + noTitle.length + ' sin titulo (mantienen UUID)');
const dupTitles = {};
plan.forEach(p => { const k = p.to.toLowerCase(); dupTitles[k] = (dupTitles[k] || 0) + 1; });
const dupes = Object.entries(dupTitles).filter(([, c]) => c > 1);
console.log('nombres duplicados (con sufijo):', dupes.length ? dupes.map(d => d[0]).join(', ') : 'ninguno');

// ejecutar renombres
let ok = 0; const errors = [];
for (const p of plan) {
  try {
    fs.renameSync(path.join(MUSIC, p.from), path.join(MUSIC, p.to));
    ok++;
  } catch (e) { errors.push(p.from + ' -> ' + p.to + ' : ' + e.message); }
}
console.log('renombrados: ' + ok + (errors.length ? ' | ERRORES: ' + errors.length : ' | sin errores'));
errors.slice(0, 5).forEach(e => console.log('  ERR:', e));

// manifiesto descargable con todo lo hecho
const manifest = {
  generado: new Date().toISOString(),
  carpeta: MUSIC,
  total: plan.length,
  renombrados: ok,
  sin_titulo_uuid: noTitle,
  canciones: plan.map(p => ({ archivo_nuevo: p.to, titulo_original: p.title, uuid_anterior: p.from }))
};
fs.writeFileSync('D:/VIBE/Owa_Studio/OWA_Music_Renombrado.json', JSON.stringify(manifest, null, 2));
const csv = 'nombre_nuevo;titulo_original_youtube;uuid_anterior\n' + plan.map(p => p.to + ';' + p.title.replace(/;/g, ',') + ';' + p.from).join('\n');
fs.writeFileSync('D:/VIBE/Owa_Studio/OWA_Music_Renombrado.csv', '\uFEFF' + csv);
console.log('manifest: D:/VIBE/Owa_Studio/OWA_Music_Renombrado.json + .csv');
// muestra final
console.log('MUESTRA FINAL:');
plan.slice(0, 12).forEach(p => console.log('  ', p.from.slice(0, 8) + '... =>', p.to));
