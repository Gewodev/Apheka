$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$qa = [IO.Path]::GetFullPath((Join-Path $repo ('src-tauri/target/installer-qa/' + [Guid]::NewGuid().ToString('N'))))
if (-not $qa.StartsWith($repo + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid QA directory' }
$null = New-Item -ItemType Directory -Force -Path $qa
$registryBase = 'Software\AphekaInstallerQA_6_7_2'
$registryPath = 'HKCU:\Software\AphekaInstallerQA_6_7_2'
$compiler = Join-Path $env:LOCALAPPDATA 'tauri/NSIS/makensis.exe'
$encoding = [Text.UTF8Encoding]::new($true)
function Save-QA($name, $value) { [IO.File]::WriteAllText((Join-Path $qa $name), $value, $encoding) }
function Compile-QA($name) {
  & $compiler /V2 (Join-Path $qa $name)
  if ($LASTEXITCODE -ne 0) { throw "NSIS compile failed: $name" }
}
function Run-QA($name) {
  $process = Start-Process -FilePath (Join-Path $qa $name) -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "QA executable failed: $name ($($process.ExitCode))" }
}
try {
  $hooks = [IO.File]::ReadAllText((Join-Path $repo 'src-tauri/installer-hooks.nsh'))
  # Every registry and data path points to disposable fixtures. Real installers
  # and the user's com.owa.studio folders cannot be matched by this harness.
  $hooks = $hooks.Replace('Software\Microsoft\Windows\CurrentVersion\Uninstall', $registryBase)
  $hooks = $hooks.Replace('$LOCALAPPDATA\com.owa.studio', "$qa\profile-local")
  $hooks = $hooks.Replace('$APPDATA\com.owa.studio', "$qa\profile-roaming")
  $hooks = $hooks.Replace('{c04548b4-0a91-545e-a9c4-28a510f945d5}', '{a0310535-d1c3-4c66-b0cf-9fe8389a1221}')
  $hooks = $hooks.Replace('{7a642181-3a2b-5476-98ce-2844134642f5}', '{a0310535-d1c3-4c66-b0cf-9fe8389a1222}')
  $hooks = $hooks.Replace('{a33f82cd-8f77-5b20-8afd-9b5687e89143}', '{a0310535-d1c3-4c66-b0cf-9fe8389a1223}')
  $hooks = $hooks.Replace('${__FILEDIR__}\installer-tools.nsh', (Join-Path $repo 'src-tauri/installer-tools.nsh'))
  Save-QA 'hooks.nsh' $hooks
  $installer = @'
Unicode true
SilentInstall silent
RequestExecutionLevel user
Name "APHEKA QA"
Var ReinstallPageCheck
OutFile "__QA__\installer.exe"
!define VERSION "6.7.2"
!define UNINSTKEY "Software\AphekaInstallerQA_6_7_2\APHEKA"
!include "__QA__\hooks.nsh"
Section
  StrCpy $INSTDIR "__QA__\installed"
  CreateDirectory "$INSTDIR"
  IfFileExists "__QA__\simulate-maintenance" 0 +3
    Call APHEKA_CAPTURE_HISTORY
    DeleteRegKey HKCU "${UNINSTKEY}"
  !insertmacro NSIS_HOOK_PREINSTALL
  !insertmacro NSIS_HOOK_POSTINSTALL
SectionEnd
'@
  Save-QA 'installer.nsi' $installer.Replace('__QA__', $qa)
  Compile-QA 'installer.nsi'
  Run-QA 'installer.exe'
  $first = Get-Content -LiteralPath (Join-Path $qa 'installed/apheka-install.json') -Raw | ConvertFrom-Json
  if ($first.hadPreviousInstall) { throw 'First install must be quiet' }
  $toolDir=Join-Path $qa 'installed/bin'
  $null=New-Item -ItemType Directory -Force -Path $toolDir
  foreach($tool in @('ffmpeg','ffprobe','yt-dlp')) {
    [IO.File]::WriteAllText((Join-Path $toolDir "$tool.exe"), 'canonical tool fixture')
    [IO.File]::WriteAllText((Join-Path $toolDir "$tool-x86_64-pc-windows-msvc.exe"), 'legacy duplicate fixture')
    [IO.File]::WriteAllText((Join-Path $qa "installed/$tool.exe"), 'legacy duplicate fixture')
  }
  [IO.File]::WriteAllText((Join-Path $toolDir 'keep-user-file.txt'), 'unrelated file fixture')
  Run-QA 'installer.exe'
  foreach($tool in @('ffmpeg','ffprobe','yt-dlp')) {
    if((Get-Content -LiteralPath (Join-Path $toolDir "$tool.exe") -Raw) -ne 'canonical tool fixture') { throw 'Canonical tool changed' }
    if(Test-Path -LiteralPath (Join-Path $toolDir "$tool-x86_64-pc-windows-msvc.exe")) { throw 'Legacy bin duplicate retained' }
    if(Test-Path -LiteralPath (Join-Path $qa "installed/$tool.exe")) { throw 'Legacy root duplicate retained' }
  }
  if((Get-Content -LiteralPath (Join-Path $toolDir 'keep-user-file.txt') -Raw) -ne 'unrelated file fixture') { throw 'Unrelated tool directory file changed' }
  $repeat = Get-Content -LiteralPath (Join-Path $qa 'installed/apheka-install.json') -Raw | ConvertFrom-Json
  if (-not $repeat.hadPreviousInstall) { throw 'Repeat install must show release notes' }
  $legacy = Join-Path $qa 'legacy'
  $null = New-Item -ItemType Directory -Path $legacy -Force
  [IO.File]::WriteAllText((Join-Path $legacy 'owa-studio.exe'), 'fixture')
  [IO.File]::WriteAllText((Join-Path $qa 'profile-local/notes-fixture.txt'), 'Notes remain intact')
  $null = New-Item -ItemType Directory -Force -Path (Join-Path $qa 'profile-roaming/music')
  [IO.File]::WriteAllText((Join-Path $qa 'profile-roaming/owa_studio_data.json'), '{"notes":["original"]}')
  [IO.File]::WriteAllBytes((Join-Path $qa 'profile-roaming/music/audio-fixture.mp3'), [byte[]](1,2,3,4))
  $stub = @'
Unicode true
SilentInstall silent
RequestExecutionLevel user
Name "OWA QA uninstaller"
OutFile "__QA__\legacy\uninstall.exe"
!include FileFunc.nsh
!include LogicLib.nsh
Section
  ${GetParameters} $0
  ${GetOptions} $0 "/UPDATE" $1
  ${If} ${Errors}
    SetErrorLevel 12
    Quit
  ${EndIf}
  Delete "__QA__\legacy\owa-studio.exe"
SectionEnd
'@
  Save-QA 'uninstall-stub.nsi' $stub.Replace('__QA__', $qa)
  Compile-QA 'uninstall-stub.nsi'
  $null = New-Item -Path "$registryPath\OWA Studio" -Force
  $values = @{ DisplayName='OWA Studio'; Publisher='owa'; InstallLocation=('"'+$legacy+'"'); UninstallString=('"'+$legacy+'\uninstall.exe"'); DisplayVersion='6.7.0' }
  foreach ($name in $values.Keys) { $null = New-ItemProperty -Path "$registryPath\OWA Studio" -Name $name -Value $values[$name] -PropertyType String -Force }
  [IO.File]::WriteAllText((Join-Path $legacy 'keep-user-file.txt'), 'Do not recurse into unknown files')
  Run-QA 'installer.exe'
  if (Test-Path -LiteralPath (Join-Path $legacy 'owa-studio.exe')) { throw 'Legacy binary was not removed' }
  if (Test-Path -LiteralPath (Join-Path $legacy 'uninstall.exe')) { throw 'Legacy uninstaller was left behind' }
  if ((Get-Content -LiteralPath (Join-Path $legacy 'keep-user-file.txt') -Raw) -ne 'Do not recurse into unknown files') { throw 'Legacy cleanup removed unknown files' }
  if ((Get-Content -LiteralPath (Join-Path $qa 'profile-local/notes-fixture.txt') -Raw) -ne 'Notes remain intact') { throw 'User data fixture changed' }
  if ((Get-Content -LiteralPath (Join-Path $qa 'profile-roaming/owa_studio_data.json') -Raw) -ne '{"notes":["original"]}') { throw 'Roaming data fixture changed' }
  if ([Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $qa 'profile-roaming/music/audio-fixture.mp3'))) -ne 'AQIDBA==') { throw 'Audio fixture changed' }
  $upgrade = Get-Content -LiteralPath (Join-Path $qa 'installed/apheka-install.json') -Raw | ConvertFrom-Json
  if ($upgrade.previousName -ne 'OWA Studio' -or $upgrade.previousVersion -ne '6.7.0') { throw 'Wrong upgrade context' }
  $null = New-Item -ItemType Directory -Force -Path $legacy
  [IO.File]::WriteAllText((Join-Path $legacy 'owa-studio.exe'), 'unrelated fixture')
  $null = Set-ItemProperty -Path "$registryPath\OWA Studio" -Name Publisher -Value 'Unrelated publisher'
  Run-QA 'installer.exe'
  if (-not (Test-Path -LiteralPath (Join-Path $legacy 'owa-studio.exe'))) { throw 'Unrelated product was removed' }
  $null = New-Item -Path "$registryPath\APHEKA" -Force
  foreach ($entry in @{ DisplayName='APHEKA'; Publisher='owa'; DisplayVersion='6.7.1' }.GetEnumerator()) {
    $null = New-ItemProperty -Path "$registryPath\APHEKA" -Name $entry.Key -Value $entry.Value -PropertyType String -Force
  }
  [IO.File]::WriteAllText((Join-Path $qa 'simulate-maintenance'), 'fixture')
  Run-QA 'installer.exe'
  $maintenance = Get-Content -LiteralPath (Join-Path $qa 'installed/apheka-install.json') -Raw | ConvertFrom-Json
  if (-not $maintenance.hadPreviousInstall -or $maintenance.previousName -ne 'APHEKA' -or $maintenance.previousVersion -ne '6.7.1') { throw 'Maintenance lost APHEKA history' }
  Write-Output 'PASS isolated NSIS hooks: first/repeat install, exact OWA removal, /UPDATE, notes/audio/data intact, canonical tools retained, legacy duplicates removed, unrelated files/publisher ignored'
} finally {
  if (Test-Path -LiteralPath $registryPath) { Remove-Item -LiteralPath $registryPath -Recurse -Force }
}
