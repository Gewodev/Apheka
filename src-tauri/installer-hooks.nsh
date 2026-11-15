; West update bridge. Only the known OWA product lineage is eligible.
!include LogicLib.nsh
!include FileFunc.nsh
!include "${__FILEDIR__}\installer-tools.nsh"
SetFont "Segoe UI" 10
!define MUI_BGCOLOR "F3F5F2"
!define MUI_TEXTCOLOR "252A2E"
!define MUI_INSTALLCOLORS "252A2E F3F5F2"
!define MUI_INSTFILESPAGE_COLORS "252A2E F3F5F2"
!define MUI_WELCOMEPAGE_TITLE "Tu espacio, a tu ritmo."
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEPAGE_TEXT "West ${VERSION} · Windows 64 bits$\r$\n$\r$\nEstudio, materiales, tareas y música, en un mismo espacio.$\r$\n$\r$\nIncluye Charvis con dictado local en español y una biblioteca musical más clara.$\r$\n$\r$\nTus notas, cursos, archivos y conversaciones se conservan.$\r$\n$\r$\nPulsa Continuar para revisar la instalación."
!define MUI_DIRECTORYPAGE_TEXT_TOP "Elige la carpeta de la aplicación. Tus materiales y conversaciones permanecen en su ubicación habitual."
!define MUI_INSTFILESPAGE_HEADER_TEXT "Preparando West"
!define MUI_INSTFILESPAGE_HEADER_SUBTEXT "Actualizando la aplicación y reutilizando los componentes ya verificados."
!define MUI_FINISHPAGE_TITLE "Tu espacio está listo"
!define MUI_FINISHPAGE_TEXT "West ${VERSION} ya está preparada.$\r$\n$\r$\nPuedes continuar con tus cursos, conversaciones y música. Los datos existentes permanecen en su carpeta habitual."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir West"
Var AphekaWelcomeTitleFont

!ifndef LEGACYUNINSTKEY
  !define LEGACYUNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA"
!endif
!ifndef LEGACYPRODUCTKEY
  !define LEGACYPRODUCTKEY "Software\owa\APHEKA"
!endif

!define MUI_CUSTOMFUNCTION_GUIINIT APHEKA_CAPTURE_HISTORY
Var /GLOBAL AphekaHadPrevious
Var /GLOBAL AphekaPreviousName
Var /GLOBAL AphekaPreviousVersion

; ---------------------------------------------------------------------------
; Lee una clave de desinstalación. Si pertenece a la familia OWA, deja:
;   $0 = DisplayName, $1 = Publisher, $2 = DisplayVersion, $3 = "1"
; ---------------------------------------------------------------------------
!macro APHEKA_READ_INSTALL_RECORD ROOT KEY
  ReadRegStr $0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "DisplayName"
  ReadRegStr $1 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "Publisher"
  ReadRegStr $2 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "DisplayVersion"
  StrCpy $3 "0"
  ${If} $0 == "${KEY}"
    StrCpy $3 "1"
  ${ElseIf} $0 == "APHEKA"
    StrCpy $3 "1"
  ${ElseIf} $0 == "POHU"
    StrCpy $3 "1"
  ${ElseIf} $0 == "POUH"
    StrCpy $3 "1"
  ${ElseIf} $0 == "OWA Studio"
    StrCpy $3 "1"
  ${ElseIf} $0 == "OwA Project"
    StrCpy $3 "1"
  ${ElseIf} $0 == "OwA Project_Beta"
    StrCpy $3 "1"
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; Captura el historial antes de que la página de mantenimiento de Tauri
; pueda eliminar el registro anterior.
; Usa solo if/else if anidados (NO goto, que es inválido en macros NSIS).
; ---------------------------------------------------------------------------
Function APHEKA_CAPTURE_HISTORY
  Push $0
  Push $1
  Push $2
  Push $3
  StrCpy $AphekaHadPrevious "false"
  StrCpy $AphekaPreviousName "West"
  StrCpy $AphekaPreviousVersion ""

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "West"
  ${If} $3 == "1"
    ; Ya está West instalado: no hay previo que reemplazar.
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "West"
  ${If} $3 == "1"
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "APHEKA"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "APHEKA"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "POHU"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "POHU"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "POUH"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "POUH"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "OWA Studio"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "OWA Studio"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "OwA Project"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "OwA Project"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "OwA Project_Beta"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "OwA Project_Beta"
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Return
  ${EndIf}

  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function APHEKA_MIGRATE_INSTALLMODE
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\West" "AllUsers"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "AllUsers"
    ${If} $0 != ""
      WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\West" "AllUsers" "1"
    ${EndIf}
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\West" "CurrentUser"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "CurrentUser"
    ${If} $0 != ""
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\West" "CurrentUser" "1"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function APHEKA_CONFIRM_REPLACE
  ; En actualizacion silenciosa (/S, la que usa el auto-actualizador) no se
  ; pregunta nada: el aviso bloquearia la instalacion en segundo plano.
  StrCpy $0 "0"
  IfSilent 0 +1
  StrCpy $0 "1"
  ${If} $0 == "1"
  ${AndIf} $AphekaHadPrevious == "true"
    MessageBox MB_OKCANCEL|MB_ICONQUESTION "Se detectó una instalación previa de ${AphekaPreviousName} (${AphekaPreviousVersion}).$\r$\n$\r$\nWest la reemplazará en este mismo equipo.$\r$\nTus notas, cursos, archivos y conversaciones se conservan en su carpeta de datos.$\r$\n$\r$\n¿Desea continuar con la instalación de West?" IDOK +2
    Abort
  ${EndIf}
FunctionEnd

!macro APHEKA_REMOVE_OWNED_SHORTCUT_IN_DIR NAME DIR SHORTCUT
  ${If} ${FileExists} "${DIR}\owa-studio.exe"
    !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\owa-studio.exe"
    Pop $R0
    ${If} $0 == 1
      Delete "${SHORTCUT}"
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "${DIR}\${NAME}.exe"
    !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\${NAME}.exe"
    Pop $R0
    ${If} $0 == 1
      Delete "${SHORTCUT}"
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "${DIR}\APHEKA.exe"
    !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\APHEKA.exe"
    Pop $R0
    ${If} $0 == 1
      Delete "${SHORTCUT}"
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "${DIR}\POHU.exe"
    !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\POHU.exe"
    Pop $R0
    ${If} $0 == 1
      Delete "${SHORTCUT}"
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "${DIR}\POUH.exe"
    !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\POUH.exe"
    Pop $R0
    ${If} $0 == 1
      Delete "${SHORTCUT}"
    ${EndIf}
  ${EndIf}
!macroend

!macro APHEKA_REMOVE_LEGACY_LINKS NAME DIR
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT_IN_DIR "${NAME}" "${DIR}" "$DESKTOP\${NAME}.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT_IN_DIR "${NAME}" "${DIR}" "$SMPROGRAMS\${NAME}.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT_IN_DIR "${NAME}" "${DIR}" "$SMPROGRAMS\${NAME}\${NAME}.lnk"
!macroend

!macro APHEKA_REMOVE_NSIS ROOT NAME
  ReadRegStr $0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "DisplayName"
  ReadRegStr $1 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "Publisher"
  ${If} $0 == "${NAME}"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName "${NAME}"
    ReadRegStr $AphekaPreviousVersion ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "DisplayVersion"
    DetailPrint "Actualizando ${NAME}. Se conservarán los datos."

    ReadRegStr $2 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "InstallLocation"
    StrCpy $3 $2 1
    ${If} $3 == '$\"'
      StrCpy $4 $2 2
      StrCpy $2 $4
      StrCpy $3 $2 -1 1
      ${If} $3 == '$\"'
        StrCpy $2 $2 1 -1
      ${EndIf}
    ${EndIf}

    ReadRegStr $3 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "UninstallString"

    ${If} $2 == ""
      DeleteRegKey ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}"
    ${Else}
      !insertmacro APHEKA_REMOVE_LEGACY_LINKS "${NAME}" "$2"

      ${If} $3 != ""
        ClearErrors
        ExecWait '$\"$3$\" /S /UPDATE _?=$2' $4
        ExecWait 'cmd /c del /f /q $3' $4
        ${If} ${Errors}
          DetailPrint "El desinstalador de ${NAME} no pudo ejecutarse."
        ${ElseIf} $4 != 0
          DetailPrint "El desinstalador de ${NAME} no pudo ejecutarse."
        ${EndIf}
      ${EndIf}

      RMDir /r "$2"

      DeleteRegKey ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}"
    ${EndIf}
  ${EndIf}
!macroend

!macro APHEKA_REMOVE_MSI GUID NAME
  System::Call 'msi::MsiEnumRelatedProductsW(w "${GUID}", i 0, i 0, w .r0) i .r1'
  ${If} $1 = 0
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName "${NAME}"
    DetailPrint "Sustituyendo ${NAME} (MSI). Se conservarán los datos."
    ExecWait '$\"$SYSDIR\msiexec.exe$\" /x $0 /qn /norestart' $4
    ${If} $4 != 0
    ${AndIf} $4 != 3010
      MessageBox MB_ICONSTOP "No se pudo sustituir ${NAME} (MSI). Cierra la versión anterior y vuelve a intentarlo."
      Abort
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  StrCpy $AphekaHadPrevious "false"
  StrCpy $AphekaPreviousName "West"
  StrCpy $AphekaPreviousVersion ""
  Call APHEKA_CAPTURE_HISTORY
  Call APHEKA_CONFIRM_REPLACE

  ${If} ${FileExists} "$LOCALAPPDATA\com.owa.studio\apheka-installed.txt"
    StrCpy $AphekaHadPrevious "true"
  ${ElseIf} ${FileExists} "$APPDATA\com.owa.studio\owa_studio_data.json"
    StrCpy $AphekaHadPrevious "true"
  ${ElseIf} ${FileExists} "$LOCALAPPDATA\com.owa.studio\EBWebView\Default\Preferences"
    StrCpy $AphekaHadPrevious "true"
  ${EndIf}

  ReadRegStr $0 SHCTX "${UNINSTKEY}" "DisplayVersion"
  ${If} $0 != ""
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousVersion $0
  ${EndIf}

  !insertmacro APHEKA_REMOVE_MSI "{c04548b4-0a91-545e-a9c4-28a510f945d5}" "OWA Studio"
  !insertmacro APHEKA_REMOVE_MSI "{7a642181-3a2b-5476-98ce-2844134642f5}" "OwA Project"
  !insertmacro APHEKA_REMOVE_MSI "{a33f82cd-8f77-5b20-8afd-9b5687e89143}" "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_MSI "{2c58d5ce-7ade-517b-ae4c-6a57e15f39fd}" "APHEKA"

  !insertmacro APHEKA_REMOVE_NSIS HKCU "APHEKA"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "APHEKA"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "POHU"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "POHU"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "POUH"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "POUH"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OWA Studio"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OWA Studio"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OwA Project"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OwA Project"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OwA Project_Beta"

  Call APHEKA_MIGRATE_INSTALLMODE
!macroend

!macro APHEKA_REMOVE_OWNED_SHORTCUT SHORTCUT
  !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $0 != 1
    !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\owa-studio.exe"
    Pop $R0
  ${EndIf}
  ${If} $0 != 1
    !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\APHEKA.exe"
    Pop $R0
  ${EndIf}
  ${If} $0 != 1
    !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\POHU.exe"
    Pop $R0
  ${EndIf}
  ${If} $0 != 1
    !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\POUH.exe"
    Pop $R0
  ${EndIf}
  ${If} $0 == 1
    Delete "${SHORTCUT}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$DESKTOP\APHEKA.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\APHEKA.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\APHEKA\APHEKA.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$DESKTOP\POHU.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\POHU.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\POHU\POHU.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$DESKTOP\POUH.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\POUH.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\POUH\POUH.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$DESKTOP\OWA Studio.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\OWA Studio.lnk"
  !insertmacro APHEKA_REMOVE_OWNED_SHORTCUT "$SMPROGRAMS\OWA Studio\OWA Studio.lnk"

  RMDir "$SMPROGRAMS\APHEKA"
  RMDir "$SMPROGRAMS\POHU"
  RMDir "$SMPROGRAMS\POUH"
  RMDir "$SMPROGRAMS\OWA Studio"

  ${If} ${FileExists} "$INSTDIR\bin\ffmpeg.exe"
    Delete "$INSTDIR\bin\ffmpeg-x86_64-pc-windows-msvc.exe"
    Delete "$INSTDIR\ffmpeg.exe"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\bin\ffprobe.exe"
    Delete "$INSTDIR\bin\ffprobe-x86_64-pc-windows-msvc.exe"
    Delete "$INSTDIR\ffprobe.exe"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\bin\yt-dlp.exe"
    Delete "$INSTDIR\bin\yt-dlp-x86_64-pc-windows-msvc.exe"
    Delete "$INSTDIR\yt-dlp.exe"
  ${EndIf}

  ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  FileOpen $7 "$INSTDIR\apheka-install.json" w
  FileWrite $7 '{$\"version$\":$\"${VERSION}$\",$\"installationId$\":$\"${VERSION}-$2$1$0-$4$5$6$\",$\"hadPreviousInstall$\":$AphekaHadPrevious,$\"previousName$\":$\"$AphekaPreviousName$\",$\"previousVersion$\":$\"$AphekaPreviousVersion$\"}'
  FileClose $7
  CreateDirectory "$LOCALAPPDATA\com.owa.studio"
  FileOpen $7 "$LOCALAPPDATA\com.owa.studio\apheka-installed.txt" w
  FileWrite $7 "${VERSION}"
  FileClose $7
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\apheka-install.json"
!macroend