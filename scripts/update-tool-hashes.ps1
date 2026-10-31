$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskLines=@('; Generated from the three bundled binaries. No runtime installation or download.')
foreach($taskEntry in @(@('FFMPEG','ffmpeg'),@('FFPROBE','ffprobe'),@('YTDLP','yt-dlp'))){
  $taskBinary=Join-Path $taskRoot ('src-tauri/bin/'+$taskEntry[1]+'-x86_64-pc-windows-msvc.exe')
  $taskHasher=[Security.Cryptography.SHA256]::Create();$taskStream=[IO.File]::OpenRead($taskBinary)
  try{$taskHash=[BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose();$taskHasher.Dispose()}
  $taskLines+='!define APHEKA_'+$taskEntry[0]+'_SHA256 "'+$taskHash+'"'
}
$taskDestination=Join-Path $taskRoot 'src-tauri/installer-assets/tool-hashes.nsh'
$taskText=[string]::Join("`r`n",$taskLines)+"`r`n"
if(!(Test-Path -LiteralPath $taskDestination) -or [IO.File]::ReadAllText($taskDestination) -ne $taskText){[IO.File]::WriteAllText($taskDestination,$taskText,[Text.UTF8Encoding]::new($false))}
