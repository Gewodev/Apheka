$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8=[Text.UTF8Encoding]::new($false)
$taskLines=@('; Generated from the bundled binaries. No runtime installation or download.')
# Only the tools that ship inside the installer are hashed here: ffprobe is not
# used by the app (the system copy is used when a tool needs it).
foreach($taskEntry in @(@('FFMPEG','ffmpeg'),@('YTDLP','yt-dlp'))){
  $taskBinary=Join-Path $taskRoot ('src-tauri/bin/'+$taskEntry[1]+'-x86_64-pc-windows-msvc.exe')
  if(!(Test-Path -LiteralPath $taskBinary)){throw 'Bundled tool missing: '+$taskEntry[1]}
  $taskHasher=[Security.Cryptography.SHA256]::Create();$taskStream=[IO.File]::OpenRead($taskBinary)
  try{$taskHash=[BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose();$taskHasher.Dispose()}
  $taskLines+='!define APHEKA_'+$taskEntry[0]+'_SHA256 "'+$taskHash+'"'
}
$taskDestination=Join-Path $taskRoot 'src-tauri/installer-assets/tool-hashes.nsh'
$taskText=[string]::Join("`r`n",$taskLines)+"`r`n"
if(!(Test-Path -LiteralPath $taskDestination) -or [IO.File]::ReadAllText($taskDestination) -ne $taskText){[IO.File]::WriteAllText($taskDestination,$taskText,$utf8)}

# The recognition models are not shipped: the app prepares them on demand and
# verifies them against the manifest. Only the license notice travels with the
# installer, as required for the bundled runtime.
$taskManifest=Get-Content -LiteralPath (Join-Path $taskRoot 'src-tauri/asr-manifest.json') -Raw | ConvertFrom-Json
$taskNotice='ONNX-LICENSE.txt'
$taskNoticePath=Join-Path $taskRoot ('src-tauri/resources/asr/'+$taskNotice)
if(!(Test-Path -LiteralPath $taskNoticePath)){throw 'The dictation license notice is missing'}
$taskExpected=@($taskManifest.files | Where-Object { $_.file -eq $taskNotice })
if($taskExpected.Count -ne 1){throw 'The dictation manifest does not describe the license notice'}
if((Get-FileHash -LiteralPath $taskNoticePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected[0].sha256.ToLowerInvariant()){throw 'The dictation license notice does not match the manifest'}
$taskHash=$taskExpected[0].sha256.ToLowerInvariant()
$taskToolLine='    !insertmacro APHEKA_TOOL_FILE "${SOURCE}" "${TARGET}" "' + $taskHash + '"'
$taskResourceLines=@(
  '; Generated from the verified dictation manifest. Only the license travels with the installer.',
  '!macro APHEKA_ASR_FILE SOURCE TARGET',
  '  !if "${TARGET}" == "asr\ONNX-LICENSE.txt"',
  $taskToolLine,
  '  !else',
  '    File /a "/oname=${TARGET}" "${SOURCE}"',
  '  !endif',
  '!macroend')
$taskDestination=Join-Path $taskRoot 'src-tauri/installer-assets/asr-files.nsh'
$taskText=[string]::Join("`r`n",$taskResourceLines)+"`r`n"
if(!(Test-Path -LiteralPath $taskDestination) -or [IO.File]::ReadAllText($taskDestination) -ne $taskText){[IO.File]::WriteAllText($taskDestination,$taskText,$utf8)}
Write-Output 'Hashes de herramientas y licencias de dictado actualizados.'
