; Generated from the verified dictation manifest. Only the license travels with the installer.
!macro APHEKA_ASR_FILE SOURCE TARGET
  !if "${TARGET}" == "asr\ONNX-LICENSE.txt"
    !insertmacro APHEKA_TOOL_FILE "${SOURCE}" "${TARGET}" "2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c"
  !else
    File /a "/oname=${TARGET}" "${SOURCE}"
  !endif
!macroend
