; Installer-only reuse. Hashing uses the Windows utility, never downloads a tool.
!include LogicLib.nsh
!include StrFunc.nsh
${StrStr}
!include "${__FILEDIR__}\installer-assets\tool-hashes.nsh"

!macro APHEKA_TOOL_FILE SOURCE TARGET HASH
  Push $0
  Push $1
  Push $2
  Push $3
  StrCpy $3 "copy"
  ${If} ${FileExists} "$INSTDIR\${TARGET}"
    nsExec::ExecToStack '"$SYSDIR\certutil.exe" -hashfile "$INSTDIR\${TARGET}" SHA256'
    Pop $0
    Pop $1
    ${If} $0 == "0"
      ${StrStr} $2 $1 "${HASH}"
      ${If} $2 != ""
        StrCpy $3 "reuse"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ${If} $3 == "reuse"
    DetailPrint "Reutilizando ${TARGET}: ya está verificado."
  ${Else}
    DetailPrint "Preparando ${TARGET}."
    File /a "/oname=${TARGET}" "${SOURCE}"
  ${EndIf}
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

!include "${__FILEDIR__}\installer-assets\asr-files.nsh"

!macro APHEKA_RESOURCE_FILE SOURCE TARGET
  !if "${TARGET}" == "bin\ffmpeg.exe"
    !insertmacro APHEKA_TOOL_FILE "${SOURCE}" "${TARGET}" "${APHEKA_FFMPEG_SHA256}"
  !else if "${TARGET}" == "bin\ffprobe.exe"
    !insertmacro APHEKA_TOOL_FILE "${SOURCE}" "${TARGET}" "${APHEKA_FFPROBE_SHA256}"
  !else if "${TARGET}" == "bin\yt-dlp.exe"
    !insertmacro APHEKA_TOOL_FILE "${SOURCE}" "${TARGET}" "${APHEKA_YTDLP_SHA256}"
  !else
    !insertmacro APHEKA_ASR_FILE "${SOURCE}" "${TARGET}"
  !endif
!macroend
