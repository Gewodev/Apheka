; West update bridge. Only the known OWA product lineage is eligible.
; /UPDATE prevents the legacy Tauri uninstaller from deleting either AppData folder.
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

; Reads one install record. Returns 1 in $3 when the record belongs to this
; product family, leaving name, publisher and version in $0, $1 and $2.
!macro APHEKA_READ_INSTALL_RECORD ROOT KEY
  ReadRegStr $0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "DisplayName"
  ReadRegStr $1 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "Publisher"
  ReadRegStr $2 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "DisplayVersion"
  StrCpy $3 "0"
  ${If} $1 == "owa"
    ${If} $0 == "${KEY}"
      StrCpy $3 "1"
    ${ElseIf} $0 == "West"
      StrCpy $3 "1"
    ${ElseIf} $0 == "APHEKA"
      StrCpy $3 "1"
    ${ElseIf} $0 == "POHU"
      StrCpy $3 "1"
    ${ElseIf} $0 == "POUH"
      StrCpy $3 "1"
    ${EndIf}
  ${EndIf}
!macroend

; Capture history before Tauri's maintenance page can remove the old registry.
; Silent updates still capture it in PREINSTALL, before copying files.
; The current identity is checked first, then the previous one.
Function APHEKA_CAPTURE_HISTORY
  Push $0
  Push $1
  Push $2
  Push $3
  !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "West"
  ${If} $3 != "1"
    !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "West"
  ${EndIf}
  ${If} $3 != "1"
    !insertmacro APHEKA_READ_INSTALL_RECORD HKCU "APHEKA"
  ${EndIf}
  ${If} $3 != "1"
    !insertmacro APHEKA_READ_INSTALL_RECORD HKLM "APHEKA"
  ${EndIf}
  ${If} $3 == "1"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName $0
    StrCpy $AphekaPreviousVersion $2
    ; An in-place update preserves verified tools. Explicit uninstall remains available.
    ${If} $ReinstallPageCheck == ""
    ${AndIf} $2 != "${VERSION}"
      StrCpy $ReinstallPageCheck 2
    ${EndIf}
  ${EndIf}
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; The previous product recorded the install scope under its own uninstall key.
; Copy that marker into the West key before MultiUser reads it, so an upgrade
; keeps the same per-user or per-machine scope instead of changing it.
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

; Muestra una ventana de confirmación cuando se detecta una instalación previa
; (APHEKA, POHU, POUH u OWA Studio). El usuario debe aceptar que West la
; reemplazará. Nunca se borran los datos del usuario (com.owa.studio en AppData).
Function APHEKA_CONFIRM_REPLACE
  StrCmp $AphekaHadPrevious "true" +2
  Abort
  MessageBox MB_OKCANCEL|MB_ICONQUESTION "Se detectó una instalación previa de una versión anterior de este producto.$\r$\n$\r$\nWest la reemplazará en este mismo equipo.$\r$\nTus notas, cursos, archivos y conversaciones se conservan en su carpeta de datos.$\r$\n$\r$\n¿Desea continuar con la instalación de West?" IDOK +2
  Abort
FunctionEnd

; Borra los accesos directos de una instalacion heredada concreta. Solo se
; borran los que apuntan a los binarios de esta misma familia dentro de la
; carpeta exacta que registro esa instalacion: un acceso directo ajeno que
; comparta nombre se conserva.
!macro APHEKA_REMOVE_OWNED_SHORTCUT_IN_DIR NAME DIR SHORTCUT
  ${If} ${FileExists} "${DIR}\owa-studio.exe"
  ${OrIf} ${FileExists} "${DIR}\${NAME}.exe"
  ${OrIf} ${FileExists} "${DIR}\APHEKA.exe"
  ${OrIf} ${FileExists} "${DIR}\POHU.exe"
  ${OrIf} ${FileExists} "${DIR}\POUH.exe"
    !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\owa-studio.exe"
    Pop $R0
    ${If} $0 != 1
      !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\${NAME}.exe"
      Pop $R0
    ${EndIf}
    ${If} $0 != 1
      !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\APHEKA.exe"
      Pop $R0
    ${EndIf}
    ${If} $0 != 1
      !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\POHU.exe"
      Pop $R0
    ${EndIf}
    ${If} $0 != 1
      !insertmacro IsShortcutTarget "${SHORTCUT}" "${DIR}\POUH.exe"
      Pop $R0
    ${EndIf}
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
  ${OrIf} $0 == "West"
  ${OrIf} $0 == "APHEKA"
  ${OrIf} $0 == "POHU"
  ${OrIf} $0 == "POUH"
    ${If} $1 == "owa"
    ReadRegStr $2 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "InstallLocation"
    ; Quita comillas de InstallLocation (NSIS las conserva al leer el registro).
    StrCpy $3 $2 1
    ${If} $3 == '$\"'
      StrCpy $4 $2 2
      StrCpy $2 $4
      ; Quita la comilla final si existe
      StrCpy $3 $2 -1 1
      ${If} $3 == '$\"'
        StrCpy $2 $2 1 -1
      ${EndIf}
    ${EndIf}
    ReadRegStr $3 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "UninstallString"
    ${If} $2 == ""
      ; Our own record without an install folder: there is nothing to replace.
      ; The key is retired so a single identity is left and no file is touched.
      DeleteRegKey ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}"
      StrCpy $AphekaHadPrevious "true"
      StrCpy $AphekaPreviousName "${NAME}"
    ${Else}
      ; La ruta de instalacion puede llevar comillas; no abortamos por ello.
      ; West se instalara en su lugar y la clave heredada se retira para dejar
      ; una sola identidad. Si hay un desinstalador legacy, lo ejecutamos con
      ; /UPDATE para preservar AppData.
      StrCpy $AphekaHadPrevious "true"
      StrCpy $AphekaPreviousName "${NAME}"
      ReadRegStr $AphekaPreviousVersion ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "DisplayVersion"
      DetailPrint "Actualizando ${NAME}. Se conservarán los datos."
      ; Los accesos directos de la version heredada se retiran antes de que
      ; su desinstalador toque nada: solo los que apuntan a esa instalacion.
      !insertmacro APHEKA_REMOVE_LEGACY_LINKS "${NAME}" "$2"
      ${If} $3 != ""
        ClearErrors
        ; $3 ya trae comillas del registro (ej. "C:\dir\uninstall.exe")
        ExecWait '$3 /S /UPDATE _?=$2' $4
        ; Borra el archivo del desinstalador legacy (cmd maneja comillas)
        ExecWait 'cmd /c del /f /q $3' $4
        ; Elimina TODA la carpeta de instalación heredada (APHEKA/POHU/…).
        ; Los datos del usuario permanecen en com.owa.studio (AppData) y no se tocan.
        RMDir /r "$2"
        ${If} ${Errors}
        ${OrIf} $4 != 0
          ; El desinstalador legacy no pudo correr; no abortamos, West
          ; instalara encima. Los datos de usuario no se tocan.
          DetailPrint "El desinstalador de ${NAME} no pudo ejecutarse."
        ${EndIf}
      ${EndIf}
      ; Retira la clave heredada para dejar una sola identidad (West).
      DeleteRegKey ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}"
    ${EndIf}
  ${EndIf}
  ${EndIf}
!macroend

; MSI lineage is identified by its exact upgrade GUID, not a fuzzy product name.
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
  ${If} $AphekaHadPrevious != "true"
    StrCpy $AphekaHadPrevious "false"
    StrCpy $AphekaPreviousName "West"
    StrCpy $AphekaPreviousVersion ""
  ${EndIf}
  Call APHEKA_CAPTURE_HISTORY
  Call APHEKA_CONFIRM_REPLACE
  ${If} ${FileExists} "$LOCALAPPDATA\com.owa.studio\apheka-installed.txt"
  ${OrIf} ${FileExists} "$APPDATA\com.owa.studio\owa_studio_data.json"
  ${OrIf} ${FileExists} "$LOCALAPPDATA\com.owa.studio\EBWebView\Default\Preferences"
    StrCpy $AphekaHadPrevious "true"
  ${EndIf}
  ReadRegStr $0 SHCTX "${UNINSTKEY}" "DisplayVersion"
  ${If} $0 != ""
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousVersion $0
  ${EndIf}
  !insertmacro APHEKA_REMOVE_NSIS HKCU "APHEKA"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "APHEKA"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OWA Studio"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OWA Studio"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OwA Project"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OwA Project"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "POHU"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "POHU"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "POUH"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "POUH"
  !insertmacro APHEKA_REMOVE_MSI "{c04548b4-0a91-545e-a9c4-28a510f945d5}" "OWA Studio"
  !insertmacro APHEKA_REMOVE_MSI "{7a642181-3a2b-5476-98ce-2844134642f5}" "OwA Project"
  !insertmacro APHEKA_REMOVE_MSI "{a33f82cd-8f77-5b20-8afd-9b5687e89143}" "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_MSI "{2c58d5ce-7ade-517b-ae4c-6a57e15f39fd}" "APHEKA"
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
  ${If} $0 != 1
    !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\OWA Studio.exe"
    Pop $R0
  ${EndIf}
  ${If} $0 == 1
    Delete "${SHORTCUT}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Both known names may still target the former executable after a rename.
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
  ; Carpetas del menu de inicio que quedaron vacias tras retirar los enlaces.
  RMDir "$SMPROGRAMS\APHEKA"
  RMDir "$SMPROGRAMS\POHU"
  RMDir "$SMPROGRAMS\POUH"
  RMDir "$SMPROGRAMS\OWA Studio"
  ; Remove only the old installer-owned duplicate names, after canonical tools exist.
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
