; APHEKA update bridge. Only the known OWA product lineage is eligible.
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
!define MUI_WELCOMEPAGE_TEXT "APHEKA ${VERSION} · Windows 64 bits$\r$\n$\r$\nEstudio, materiales, tareas y música, en un mismo espacio.$\r$\n$\r$\nIncluye Charvis con dictado local en español y una biblioteca musical más clara.$\r$\n$\r$\nTus notas, cursos, archivos y conversaciones se conservan.$\r$\n$\r$\nPulsa Continuar para revisar la instalación."
!define MUI_DIRECTORYPAGE_TEXT_TOP "Elige la carpeta de la aplicación. Tus materiales y conversaciones permanecen en su ubicación habitual."
!define MUI_INSTFILESPAGE_HEADER_TEXT "Preparando APHEKA"
!define MUI_INSTFILESPAGE_HEADER_SUBTEXT "Actualizando la aplicación y reutilizando los componentes ya verificados."
!define MUI_FINISHPAGE_TITLE "Tu espacio está listo"
!define MUI_FINISHPAGE_TEXT "APHEKA ${VERSION} ya está preparada.$\r$\n$\r$\nPuedes continuar con tus cursos, conversaciones y música. Los datos existentes permanecen en su carpeta habitual."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir APHEKA"
Var AphekaWelcomeTitleFont

!define MUI_CUSTOMFUNCTION_GUIINIT APHEKA_CAPTURE_HISTORY
Var AphekaHadPrevious
Var AphekaPreviousName
Var AphekaPreviousVersion

; Capture history before Tauri's maintenance page can remove the old registry.
; Silent updates still capture it in PREINSTALL, before copying files.
Function APHEKA_CAPTURE_HISTORY
  Push $0
  Push $1
  Push $2
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "DisplayName"
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "Publisher"
  ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "DisplayVersion"
  ${If} $0 != "APHEKA"
  ${OrIf} $1 != "owa"
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "DisplayName"
    ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "Publisher"
    ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\APHEKA" "DisplayVersion"
  ${EndIf}
  ${If} $0 == "APHEKA"
  ${AndIf} $1 == "owa"
    StrCpy $AphekaHadPrevious "true"
    StrCpy $AphekaPreviousName "APHEKA"
    StrCpy $AphekaPreviousVersion $2
    ; An in-place update preserves verified tools. Explicit uninstall remains available.
    ${If} $ReinstallPageCheck == ""
      ${If} $2 != "${VERSION}"
        StrCpy $ReinstallPageCheck 2
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

!macro APHEKA_REMOVE_NSIS ROOT NAME
  ReadRegStr $0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "DisplayName"
  ReadRegStr $1 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "Publisher"
  ${If} $0 == "${NAME}"
  ${AndIf} $1 == "owa"
    ReadRegStr $2 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "InstallLocation"
    StrCpy $3 $2 1
    ${If} $3 == '$\"'
      StrCpy $2 $2 -1 1
    ${EndIf}
    ReadRegStr $3 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "UninstallString"
    ${If} $2 != ""
    ${AndIf} $3 == '$\"$2\uninstall.exe$\"'
    ${AndIf} ${FileExists} "$2\owa-studio.exe"
    ${AndIf} ${FileExists} "$2\uninstall.exe"
      StrCpy $AphekaHadPrevious "true"
      StrCpy $AphekaPreviousName "${NAME}"
      ReadRegStr $AphekaPreviousVersion ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NAME}" "DisplayVersion"
      DetailPrint "Actualizando ${NAME}. Se conservarán los datos."
      ClearErrors
      ExecWait '$\"$2\uninstall.exe$\" /S /UPDATE _?=$2' $4
      ${If} ${Errors}
      ${OrIf} $4 != 0
      ${OrIf} ${FileExists} "$2\owa-studio.exe"
        MessageBox MB_ICONSTOP "No se pudo sustituir ${NAME}. Cierra esa aplicación y vuelve a ejecutar el instalador. Tus datos no se han eliminado."
        Abort
      ${EndIf}
      ; _?= runs the old uninstaller in place. Remove only its verified file,
      ; then remove the directory only if empty; never recurse into user files.
      Delete "$2\uninstall.exe"
      RMDir "$2"
    ${Else}
      MessageBox MB_ICONSTOP "Se encontró ${NAME}, pero su registro de instalación no es el esperado. Desinstala esa versión conservando los datos antes de instalar APHEKA."
      Abort
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
    StrCpy $AphekaPreviousName "APHEKA"
    StrCpy $AphekaPreviousVersion ""
  ${EndIf}
  Call APHEKA_CAPTURE_HISTORY
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
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OWA Studio"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OWA Studio"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OwA Project"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OwA Project"
  !insertmacro APHEKA_REMOVE_NSIS HKCU "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_NSIS HKLM "OwA Project_Beta"
  !insertmacro APHEKA_REMOVE_MSI "{c04548b4-0a91-545e-a9c4-28a510f945d5}" "OWA Studio"
  !insertmacro APHEKA_REMOVE_MSI "{7a642181-3a2b-5476-98ce-2844134642f5}" "OwA Project"
  !insertmacro APHEKA_REMOVE_MSI "{a33f82cd-8f77-5b20-8afd-9b5687e89143}" "OwA Project_Beta"
!macroend

!macro NSIS_HOOK_POSTINSTALL
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
