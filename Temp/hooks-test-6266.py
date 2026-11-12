from pathlib import Path
s=Path('scripts/test-installer-hooks.ps1').read_text(encoding='utf-8').replace('AphekaInstallerQA_6_7_2','PohuInstallerQA_6_26_6')
s=s.replace("Save-QA 'hooks.nsh' $hooks",'''$hooks = $hooks.Replace('$DESKTOP', "$qa\\shortcuts-desktop").Replace('$SMPROGRAMS', "$qa\\shortcuts-menu")
  Save-QA 'hooks.nsh' $hooks''')
s=s.replace('!include "__QA__\\hooks.nsh"','''!define MAINBINARYNAME "owa-studio"
!include "Win\\COM.nsh"
!include "__ROOT__\\src-tauri\\target\\release\\nsis\\x64\\utils.nsh"
!include "__QA__\\hooks.nsh"''')
s=s.replace("$installer.Replace('__QA__', $qa)","$installer.Replace('__QA__', $qa).Replace('__ROOT__', $repo)")
s=s.replace("  Write-Output 'PASS isolated NSIS hooks:",'''  Set-ItemProperty -Path "$registryPath\\APHEKA" -Name DisplayName -Value 'POHU'
  Run-QA 'installer.exe'
  $renamed=Get-Content -LiteralPath (Join-Path $qa 'installed/apheka-install.json') -Raw|ConvertFrom-Json
  if(!$renamed.hadPreviousInstall -or $renamed.previousName -ne 'POHU'){throw 'POHU update identity lost'}
  Write-Output 'PASS POHU rename and isolated NSIS hooks:''')
Path('scripts/test-installer-hooks-6266.ps1').write_text(s,encoding='utf-8')
