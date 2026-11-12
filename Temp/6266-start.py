from pathlib import Path
import json,re
for file in ['package.json','src-tauri/tauri.conf.json','src-tauri/tauri.prod.conf.json']:
 p=Path(file);data=json.loads(p.read_text('utf-8-sig'));data['version']='6.26.6'
 if 'productName' in data:data['productName']='POHU'
 if 'app' in data:
  for win in data['app'].get('windows',[]):win['title']='POHU'
 p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n','utf-8')
p=Path('src-tauri/Cargo.toml');s=p.read_text('utf-8').replace('version = "6.26.5"','version = "6.26.6"',1);p.write_text(s,'utf-8')
p=Path('src-tauri/Cargo.lock');s=p.read_text('utf-8').replace('name = "owa-studio"\nversion = "6.26.5"','name = "owa-studio"\nversion = "6.26.6"');p.write_text(s,'utf-8')
p=Path('src-tauri/installer-template.nsi');s=p.read_text('utf-8').replace('!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCTNAME}"','; Preserve upgrade identity and install location across the POHU name change.\n!define UNINSTKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\APHEKA"').replace('!define MANUPRODUCTKEY "${MANUKEY}\\${PRODUCTNAME}"','!define MANUPRODUCTKEY "${MANUKEY}\\APHEKA"');p.write_text(s,'utf-8')
p=Path('src-tauri/installer-hooks.nsh');s=p.read_text('utf-8');s=s.replace('"APHEKA ${VERSION}', '"POHU ${VERSION}').replace('Preparando APHEKA','Preparando POHU').replace('Abrir APHEKA','Abrir POHU').replace('antes de instalar APHEKA','antes de instalar POHU')
s=s.replace('${If} $0 != "APHEKA"\n  ${OrIf}', '${If} $0 != "APHEKA"\n  ${AndIf} $0 != "POHU"\n  ${OrIf}').replace('${If} $0 == "APHEKA"\n  ${AndIf} $1 == "owa"','${If} $0 == "APHEKA"\n  ${OrIf} $0 == "POHU"\n    ${If} $1 == "owa"').replace('StrCpy $AphekaPreviousName "APHEKA"\n    StrCpy $AphekaPreviousVersion $2','StrCpy $AphekaPreviousName $0\n    StrCpy $AphekaPreviousVersion $2').replace('  ${EndIf}\n  Pop $2','    ${EndIf}\n  ${EndIf}\n  Pop $2',1)
p.write_text(s,'utf-8')
p=Path('scripts/package-final.ps1');s=p.read_text('utf-8').replace('  $version = $config.version','  $version = $config.version\n  $product = $config.productName\n  $prefix = $product.ToLowerInvariant()');s=s.replace('bundle/nsis/APHEKA_${version}', 'bundle/nsis/${product}_${version}').replace("-ne 'APHEKA'",'-ne $product').replace("'apheka_FINAL.exe'",'($prefix+\'_FINAL.exe\')').replace("product='APHEKA';",'product=$product;').replace("file='apheka_FINAL.exe';","file=($prefix+'_FINAL.exe');").replace("'apheka_FINAL.json'","($prefix+'_FINAL.json')");p.write_text(s,'utf-8')
p=Path('scripts/create-installer-art.ps1');s=p.read_text('utf-8').replace("$g.DrawString('APHEKA', $name, $light, 20, 98)",'Draw-Pohu $g $light.Color 22 99 1.0').replace("$g.DrawString('APHEKA', $headerName, $ink, 45, 11)",'Draw-Pohu $g $ink.Color 45 13 0.64').replace("('APHEKA ' + $version)","('POHU ' + $version)")
fn='''function Draw-Pohu($graphics,$color,[single]$x,[single]$y,[single]$scale) {
  $state=$graphics.Save();$graphics.TranslateTransform($x,$y);$graphics.ScaleTransform($scale,$scale)
  $pen=[Drawing.Pen]::new($color,3.4);$pen.StartCap=$pen.EndCap=[Drawing.Drawing2D.LineCap]::Round
  try {
    $graphics.DrawLine($pen,1,28,1,1);$graphics.DrawLine($pen,1,1,12,1);$graphics.DrawArc($pen,4,1,17,16,270,180);$graphics.DrawLine($pen,12,17,1,17)
    $graphics.DrawEllipse($pen,31,1,22,27)
    $graphics.DrawLine($pen,65,1,65,28);$graphics.DrawLine($pen,87,1,87,28);$graphics.DrawLine($pen,65,14,87,14)
    $graphics.DrawLine($pen,100,1,100,17);$graphics.DrawArc($pen,100,6,22,22,0,180);$graphics.DrawLine($pen,122,17,122,1)
  } finally {$pen.Dispose();$graphics.Restore($state)}
}
'''
s=s.replace('try {\n  foreach ($kind',fn+'try {\n  foreach ($kind');s=s.replace('APHEKA installer artwork generated','POHU installer artwork generated');p.write_text(s,'utf-8')
p=Path('src/lib/compatiblePointer.ts');s=p.read_text('utf-8').replace("localStorage.getItem(POINTER_PREFERENCE)==='on'","localStorage.getItem(POINTER_PREFERENCE)!=='off'").replace('catch{return false;}','catch{return true;}');p.write_text(s,'utf-8')
p=Path('src/hooks/useWindowFullscreen.ts');s=p.read_text('utf-8').replace('      await recoverPointer(true);',"      if(!windowFullscreen.getSnapshot().active||!compatiblePointerEnabled())await recoverPointer(true);");p.write_text(s,'utf-8')
