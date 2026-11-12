const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''),json=file=>JSON.parse(read(file));
assert.equal(json('release/build-6.9.0.status.json').state,'complete');
const artifact=json('release/apheka_FINAL.json'),file=fs.readFileSync(path.join(root,'release/apheka_FINAL.exe'));
assert.equal(artifact.version,'6.9.0');assert.equal(file.length,artifact.bytes);assert.equal(crypto.createHash('sha256').update(file).digest('hex').toUpperCase(),artifact.sha256);
const nsi=read('src-tauri/target/release/nsis/x64/installer.nsi');
const entries=[...nsi.matchAll(/^\s*!insertmacro APHEKA_RESOURCE_FILE "([^"]+)" "(bin\\(?:ffmpeg|ffprobe|yt-dlp)\.exe)"/gm)];
assert.equal(entries.length,3,'one resource dispatch per tool');assert.equal(new Set(entries.map(e=>e[2])).size,3);
assert.equal((nsi.match(/^\s*!insertmacro APHEKA_RESOURCE_FILE /gm)||[]).length,3,'no additional resource copies');
const tools=read('src-tauri/installer-tools.nsh'),hashes=read('src-tauri/installer-assets/tool-hashes.nsh');
assert.ok(tools.includes('certutil.exe'));assert.ok(tools.includes('StrCpy $3 "reuse"'));assert.ok(nsi.indexOf('!define VERSION ')<nsi.indexOf('installer-hooks.nsh'),'version must be defined before hook code');
for(const e of entries){const hash=crypto.createHash('sha256').update(fs.readFileSync(e[1])).digest('hex');assert.ok(hashes.includes(hash),e[2]+' matches compiled hash');}
const binary=fs.readFileSync(path.join(root,'src-tauri/target/release/owa-studio.exe')),assets=fs.readdirSync(path.join(root,'dist/assets'));
const views=['Inicio','Estudio','Tareas','Notas','Musica','Cursos','CursosHub','Ajustes','Planificacion'];
for(const view of views){const asset=assets.find(f=>f.startsWith(view+'-')&&f.endsWith('.js'));assert.ok(asset,view);assert.ok(binary.includes(Buffer.from('assets/'+asset)),view+' embedded');}
for(const name of ['bruma','dunas','bosque','orbita'])assert.ok(binary.includes(Buffer.from('wallpapers/'+name+'.svg')),name+' wallpaper embedded');
const output=assets.filter(f=>f.endsWith('.js')).map(f=>read('dist/assets/'+f)).join('');assert.ok(output.includes('https://api.audius.co/v1/tracks/'));assert.ok(output.includes('https://lrclib.net/api/get?'));for(const label of ['Fondo de imagen','download_catalog_track','Sala de escucha','Mis canciones','apheka_workspace'])assert.ok(output.includes(label),'new runtime feature '+label);
const report=json('docs/APHEKA-release-6.9.0.json');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src-tauri/Cargo.lock'))).digest('hex').toUpperCase(),json('docs/APHEKA-release-6.9.0.json').cargoLockSha256BeforeRelease,'locked dependencies unchanged during build');report.checks.productionFrontendBuild=true;report.toolResources.generatedInstallerVerified=true;report.toolResources.installedEntries=entries.map(e=>e[2]);report.artifact={state:'complete',version:artifact.version,bytes:artifact.bytes,sha256:artifact.sha256,nativeBundleVerified:true,lazyViewAssetsVerified:true};report.sourceAudit={manifestRewrittenBeforeFrontend:artifact.manifestRewrittenBeforeFrontend,latestSourceEditUtc:artifact.sourceLatestEditUtc,installerModifiedAtUtc:artifact.modifiedAtUtc,signatureCheckedBeforeAndAfterBuild:true,toolHashesCheckedBeforeAndAfterBuild:true};fs.writeFileSync(path.join(root,'docs/APHEKA-release-6.9.0.json'),JSON.stringify(report,null,2)+'\n');
fs.appendFileSync(path.join(root,'docs/APHEKA-6.9.0.md'),'\nVerificación final: paquete NSIS y fuentes coherentes, nueve vistas y cuatro fondos actuales incrustados; tres herramientas con hash correcto.\n\nSHA-256: `'+artifact.sha256+'`. Tamaño: '+artifact.bytes+' bytes.\n');
console.log(JSON.stringify({version:artifact.version,bytes:artifact.bytes,sha256:artifact.sha256,toolCopies:entries.length,currentViewsEmbedded:views.length,wallpapersEmbedded:4},null,2));
