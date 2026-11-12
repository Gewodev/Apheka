from pathlib import Path
p=Path('src-tauri/src/playlist_import.rs');s=p.read_text('utf-8');s='use tauri::Manager;\n'+s;p.write_text(s,'utf-8')
p=Path('src-tauri/installer-assets/Spanish.nsh');s=p.read_text('utf-8').replace('APHEKA','POHU');p.write_text(s,'utf-8')
p=Path('src-tauri/installer-hooks.nsh');s=p.read_text('utf-8');needle='!macro NSIS_HOOK_POSTINSTALL\n';extra='''!macro NSIS_HOOK_POSTINSTALL
  ; Rename only installer-owned legacy shortcuts with an exact executable target.
  !insertmacro IsShortcutTarget "$DESKTOP\\APHEKA.lnk" "$INSTDIR\\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 == 1
    Delete "$DESKTOP\\APHEKA.lnk"
  ${EndIf}
  !insertmacro IsShortcutTarget "$SMPROGRAMS\\APHEKA.lnk" "$INSTDIR\\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 == 1
    Delete "$SMPROGRAMS\\APHEKA.lnk"
  ${EndIf}
''';s=s.replace(needle,extra);p.write_text(s,'utf-8')
