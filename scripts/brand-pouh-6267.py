from pathlib import Path
import json,re
r=Path(__file__).resolve().parent.parent
# Product labels change; persistent identifiers, credential targets and data paths do not.
for p in (r/'src').rglob('*'):
    if p.suffix not in ('.ts','.tsx'):continue
    s=p.read_text(encoding='utf-8-sig');v=re.sub(r'\b(?:APHEKA|POHU|Apheka)\b','POUH',s)
    if v!=s:p.write_text(v,encoding='utf-8')
p=r/'src/lib/google/tasks.ts';s=p.read_text(encoding='utf-8');s=s.replace("lists.find(l => l.title === 'POUH') ||", "lists.find(l => l.title === 'POUH') || lists.find(l => l.title === 'APHEKA') ||");p.write_text(s,encoding='utf-8')
p=r/'index.html';s=p.read_text(encoding='utf-8').replace('APHEKA','POUH').replace('POHU','POUH');p.write_text(s,encoding='utf-8')
for f in ['src-tauri/tauri.conf.json','src-tauri/tauri.prod.conf.json']:
    p=r/f;s=json.loads(p.read_text(encoding='utf-8-sig'));s['productName']='POUH';s['mainBinaryName']='POUH'
    for w in s.get('app',{}).get('windows',[]):w['title']='POUH'
    p.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Keep legacy credential names / download directories addressable after upgrading.
for f in ['external_open.rs','local_asr.rs','mcp.rs','charvis_web.rs','catalog_download.rs']:
    p=r/'src-tauri/src'/f;s=p.read_text(encoding='utf-8');v=re.sub(r'\bAPHEKA\b','POUH',s)
    if v!=s:p.write_text(v,encoding='utf-8')
p=r/'src-tauri/src/main.rs';s=p.read_text(encoding='utf-8').replace('.header("User-Agent", "APHEKA")','.header("User-Agent", "POUH")');p.write_text(s,encoding='utf-8')
p=r/'src-tauri/installer-hooks.nsh';s=p.read_text(encoding='utf-8').replace('POHU ${VERSION}','POUH ${VERSION}').replace('Preparando POHU','Preparando POUH').replace('Abrir POHU','Abrir POUH').replace('instalar POHU.','instalar POUH.')
s=s.replace('${AndIf} $0 != "POHU"','${AndIf} $0 != "POHU"\n  ${AndIf} $0 != "POUH"').replace('${OrIf} $0 == "POHU"','${OrIf} $0 == "POHU"\n  ${OrIf} $0 == "POUH"')
p.write_text(s,encoding='utf-8')
p=r/'src-tauri/installer-template.nsi';s=p.read_text(encoding='utf-8');s=s.replace('BrandingText "APHEKA','BrandingText "POUH').replace('Caption "APHEKA','Caption "POUH').replace('"FileDescription" "APHEKA','"FileDescription" "POUH')
# An update checks the previous executable as well as the renamed one, before copying.
needle='  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"'
pos=s.index(needle,s.index('Section Install'))
s=s[:pos]+'''  ReadRegStr $OldMainBinaryName SHCTX "${UNINSTKEY}" "MainBinaryName"
  ${If} $OldMainBinaryName == "owa-studio.exe"
  ${AndIf} ${FileExists} "$INSTDIR\\owa-studio.exe"
    !insertmacro CheckIfAppIsRunning "owa-studio.exe" "${PRODUCTNAME}"
  ${EndIf}
'''+s[pos:]
p.write_text(s,encoding='utf-8')
p=r/'scripts/package-final.ps1';s=p.read_text(encoding='utf-8');s=s.replace("$embedded = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes((Join-Path $repo 'src-tauri/target/release/owa-studio.exe')))","$executableName=if($config.mainBinaryName){$config.mainBinaryName}else{'owa-studio'}\n  $executablePath=Join-Path $repo (\"src-tauri/target/release/$executableName.exe\")\n  $executable=Get-Item -LiteralPath $executablePath\n  if($executable.VersionInfo.ProductName -ne $product -or $executable.VersionInfo.ProductVersion -ne $version){throw 'Executable brand/version mismatch'}\n  $embedded = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($executablePath))")
s=s.replace("product=$product;version=$version;identifier=$config.identifier","product=$product;version=$version;identifier=$config.identifier;executable=($executableName+'.exe')")
p.write_text(s,encoding='utf-8')
