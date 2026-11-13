$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
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
if(!(Test-Path -LiteralPath $taskDestination) -or [IO.File]::ReadAllText($taskDestination) -ne $taskText){[IO.File]::WriteAllText($taskDestination,$taskText,[Text.UTF8Encoding]::new($false))}

# Include every shipped dictation resource, including its license notices.
$taskManifest=Get-Content -LiteralPath (Join-Path $taskRoot 'src-tauri/asr-manifest.json') -Raw | ConvertFrom-Json
$taskEntries=@($taskManifest.files)
$taskNotice=Join-Path $taskRoot 'src-tauri/resources/asr/NOTICE.txt'
if(Test-Path -LiteralPath $taskNotice){$taskEntries+=[pscustomobject]@{file='NOTICE.txt';sha256=(Get-FileHash -LiteralPath $taskNotice -Algorithm SHA256).Hash.ToLowerInvariant()}}
$taskAsrRoot=[IO.Path]::GetFullPath((Join-Path $taskRoot 'src-tauri/resources/asr'))
foreach($taskFound in Get-ChildItem -LiteralPath $taskAsrRoot -Recurse -File){
  $taskRelative=$taskFound.FullName.Substring($taskAsrRoot.Length+1).Replace('\','/')
  if($taskRelative -notin $taskEntries.file){throw "Unexpected ASR resource: $taskRelative"}
}
$taskResourceLines=@('; Generated from the verified ASR manifest and local notice. Do not edit.','!macro APHEKA_ASR_FILE SOURCE TARGET')
$taskFirst=$true
foreach($taskResource in $taskEntries){
  if($taskResource.file -notmatch '^[a-zA-Z0-9_./-]+$' -or $taskResource.file -match '(^|/)\.\.(/|$)'){throw 'Invalid ASR resource path'}
  $taskPath=Join-Path $taskRoot ('src-tauri/resources/asr/'+$taskResource.file)
  if((Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskResource.sha256.ToLowerInvariant()){throw "ASR resource does not match manifest: $($taskResource.file)"}
  $taskTarget='asr\'+$taskResource.file.Replace('/','\')
  $taskBranch=if($taskFirst){'  !if'}else{'  !else if'}
  $taskResourceLines+=$taskBranch+' "${TARGET}" == "'+$taskTarget+'"'
  $taskResourceLines+='    !insertmacro APHEKA_TOOL_FILE "${SOURCE}" "${TARGET}" "'+$taskResource.sha256.ToLowerInvariant()+'"'
  $taskFirst=$false
}
$taskResourceLines+=@('  !else','    File /a "/oname=${TARGET}" "${SOURCE}"','  !endif','!macroend')
$taskDestination=Join-Path $taskRoot 'src-tauri/installer-assets/asr-files.nsh'
$taskText=[string]::Join("`r`n",$taskResourceLines)+"`r`n"
if(!(Test-Path -LiteralPath $taskDestination) -or [IO.File]::ReadAllText($taskDestination) -ne $taskText){[IO.File]::WriteAllText($taskDestination,$taskText,[Text.UTF8Encoding]::new($false))}
Write-Output 'Hashes de herramientas y recursos de dictado actualizados.'
