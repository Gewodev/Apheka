from pathlib import Path
p=Path('scripts/test-installer-hooks-6266.ps1');s=p.read_text(encoding='utf-8');s=s.replace('  !insertmacro NSIS_HOOK_POSTINSTALL', '''  CreateDirectory "__QA__\\shortcuts-desktop"
  CreateDirectory "__QA__\\shortcuts-menu"
  CreateShortCut "__QA__\\shortcuts-desktop\\APHEKA.lnk" "$INSTDIR\\owa-studio.exe"
  CreateShortCut "__QA__\\shortcuts-menu\\APHEKA.lnk" "__QA__\\unrelated.exe"
  !insertmacro NSIS_HOOK_POSTINSTALL''');s=s.replace("  $first = Get-Content",'''  if(Test-Path -LiteralPath (Join-Path $qa 'shortcuts-desktop/APHEKA.lnk')){throw 'Owned legacy shortcut retained'}
  if(!(Test-Path -LiteralPath (Join-Path $qa 'shortcuts-menu/APHEKA.lnk'))){throw 'Unrelated shortcut removed'}
  $first = Get-Content''',1);s=s.replace('PASS POHU rename and isolated NSIS hooks:','PASS POHU rename, exact-target shortcut cleanup and isolated NSIS hooks:');p.write_text(s,encoding='utf-8')
