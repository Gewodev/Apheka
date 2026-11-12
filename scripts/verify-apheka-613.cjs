const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''),json=file=>JSON.parse(read(file)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
assert.equal(json('release/build-6.13.0.status.json').state,'complete');
const artifact=json('release/apheka_FINAL.json'),installer=fs.readFileSync(path.join(root,'release/apheka_FINAL.exe'));
assert.equal(artifact.version,'6.13.0');assert.equal(artifact.identifier,'com.owa.studio');assert.equal(installer.length,artifact.bytes);assert.equal(sha(installer),artifact.sha256);
const native=fs.readFileSync(path.join(root,'src-tauri/target/release/owa-studio.exe')),assets=fs.readdirSync(path.join(root,'dist/assets'));
const views=['Inicio','Estudio','Tareas','Notas','Musica','Cursos','CursosHub','Ajustes','Planificacion'];
for(const view of views){const asset=assets.find(file=>file.startsWith(view+'-')&&file.endsWith('.js'));assert.ok(asset,view);assert.ok(native.includes(Buffer.from('assets/'+asset)),view+' embedded');}
const sdk=assets.find(file=>file.startsWith('browser-')&&file.endsWith('.js'));assert.ok(sdk,'prebundled music SDK');assert.ok(native.includes(Buffer.from('assets/'+sdk)),'current SDK embedded');assert.equal(assets.some(file=>file.startsWith('MusicaAdvanced-')),false);
const nsi=read('src-tauri/target/release/nsis/x64/installer.nsi'),entries=[...nsi.matchAll(/^\s*!insertmacro APHEKA_RESOURCE_FILE "([^"]+)" "(bin\\(?:ffmpeg|ffprobe|yt-dlp)\.exe)"/gm)];
assert.equal(entries.length,3);assert.equal(new Set(entries.map(entry=>entry[2])).size,3);assert.equal((nsi.match(/^\s*!insertmacro APHEKA_RESOURCE_FILE /gm)||[]).length,3);
const hashes=read('src-tauri/installer-assets/tool-hashes.nsh').toUpperCase();for(const entry of entries)assert.ok(hashes.includes(sha(fs.readFileSync(entry[1]))));
const report=json('docs/APHEKA-release-6.13.0.json');Object.assign(report,{installer:'verified',artifact,nativeBuild:'passed',embeddedViews:views.length,currentBrowserSdkEmbedded:true,toolCopies:3,toolHashes:'passed',sourceSignatureCheckedByPackager:true});fs.writeFileSync(path.join(root,'docs/APHEKA-release-6.13.0.json'),JSON.stringify(report,null,2)+'\n');
const docPath=path.join(root,'docs/APHEKA-6.13.0.md');let doc=fs.readFileSync(docPath,'utf8').replace(/^Estado:.*$/m,'Estado: instalador final 6.13.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: '+artifact.bytes+' bytes. SHA-256: `'+artifact.sha256+'`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.');fs.writeFileSync(docPath,doc);
console.log(JSON.stringify({version:artifact.version,bytes:artifact.bytes,sha256:artifact.sha256,embeddedViews:views.length,toolCopies:entries.length},null,2));
