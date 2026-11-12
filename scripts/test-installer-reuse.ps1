$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskQa=[IO.Path]::GetFullPath((Join-Path $taskRoot ('src-tauri/target/tool-reuse-qa/'+[Guid]::NewGuid().ToString('N'))))
if(!$taskQa.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid QA path'}
$null=New-Item -ItemType Directory -Force -Path $taskQa
$taskInput=Join-Path $taskQa 'tool-source.exe';[IO.File]::WriteAllText($taskInput,'APHEKA verified tool fixture v1')
$taskHash=(Get-FileHash -LiteralPath $taskInput -Algorithm SHA256).Hash.ToLowerInvariant()
$taskScript=@'
Unicode true
SilentInstall silent
RequestExecutionLevel user
Name "APHEKA tools QA"
OutFile "__QA__\test.exe"
!include "__ROOT__\src-tauri\installer-tools.nsh"
Section
 StrCpy $INSTDIR "__QA__\installed"
 CreateDirectory "$INSTDIR\bin"
 SetOutPath "$INSTDIR"
 !insertmacro APHEKA_TOOL_FILE "__QA__\tool-source.exe" "bin\ffmpeg.exe" "__HASH__"
 !insertmacro APHEKA_TOOL_FILE "__QA__\tool-source.exe" "bin\ffprobe.exe" "__HASH__"
 !insertmacro APHEKA_TOOL_FILE "__QA__\tool-source.exe" "bin\yt-dlp.exe" "__HASH__"
SectionEnd
'@
$taskScript=$taskScript.Replace('__QA__',$taskQa).Replace('__ROOT__',$taskRoot).Replace('__HASH__',$taskHash)
[IO.File]::WriteAllText((Join-Path $taskQa 'test.nsi'),$taskScript,[Text.UTF8Encoding]::new($true))
& (Join-Path $env:LOCALAPPDATA 'tauri/NSIS/makensis.exe') /V2 (Join-Path $taskQa 'test.nsi')
if($LASTEXITCODE -ne 0){throw 'NSIS compile failed'}
function Run-ToolFixture {$taskProcess=Start-Process -FilePath (Join-Path $taskQa 'test.exe') -WindowStyle Hidden -Wait -PassThru;if($taskProcess.ExitCode -ne 0){throw 'Fixture failed'}}
Run-ToolFixture
$taskKeptTime=[DateTime]::SpecifyKind([DateTime]'2001-02-03T04:05:06',[DateTimeKind]::Utc)
foreach($taskName in @('ffmpeg','ffprobe','yt-dlp')){[IO.File]::SetLastWriteTimeUtc((Join-Path $taskQa "installed/bin/$taskName.exe"),$taskKeptTime)}
Run-ToolFixture
foreach($taskName in @('ffmpeg','ffprobe','yt-dlp')){if([IO.File]::GetLastWriteTimeUtc((Join-Path $taskQa "installed/bin/$taskName.exe")) -ne $taskKeptTime){throw "Valid tool was rewritten: $taskName"}}
[IO.File]::WriteAllText((Join-Path $taskQa 'installed/bin/ffmpeg.exe'),'corrupt')
Remove-Item -LiteralPath (Join-Path $taskQa 'installed/bin/ffprobe.exe')
Run-ToolFixture
foreach($taskName in @('ffmpeg','ffprobe','yt-dlp')){if((Get-FileHash -LiteralPath (Join-Path $taskQa "installed/bin/$taskName.exe") -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskHash){throw 'Invalid tool not restored'}}
if([IO.File]::GetLastWriteTimeUtc((Join-Path $taskQa 'installed/bin/yt-dlp.exe')) -ne $taskKeptTime){throw 'Unchanged tool rewritten while repairing another tool'}
'PASS installer tool reuse: valid SHA-256 tools untouched despite different dates, corrupt/missing tools replaced, no network or personal installation changes'
