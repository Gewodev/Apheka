$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskQa=[IO.Path]::GetFullPath((Join-Path $taskRoot ('src-tauri/target/asr-reuse-qa/'+[Guid]::NewGuid().ToString('N'))))
if(!$taskQa.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid QA path'}
$null=New-Item -ItemType Directory -Force -Path $taskQa
$taskCompiler=Join-Path $taskRoot 'src-tauri/target/.tauri/NSIS/makensis.exe'
if(!(Test-Path -LiteralPath $taskCompiler)){$taskCompiler=Join-Path $env:LOCALAPPDATA 'tauri/NSIS/makensis.exe'}
$taskScript=@'
Unicode true
SilentInstall silent
RequestExecutionLevel user
Name "APHEKA ASR reuse QA"
OutFile "__QA__\test.exe"
!include "__ROOT__\src-tauri\installer-tools.nsh"
Section
 StrCpy $INSTDIR "__QA__\installed"
 CreateDirectory "$INSTDIR\asr\model"
 SetOutPath "$INSTDIR"
 !insertmacro APHEKA_RESOURCE_FILE "__ROOT__\src-tauri\resources\asr\LICENSE.txt" "asr\LICENSE.txt"
 !insertmacro APHEKA_RESOURCE_FILE "__ROOT__\src-tauri\resources\asr\ONNX-LICENSE.txt" "asr\ONNX-LICENSE.txt"
 !insertmacro APHEKA_RESOURCE_FILE "__ROOT__\src-tauri\resources\asr\NOTICE.txt" "asr\NOTICE.txt"
 !insertmacro APHEKA_RESOURCE_FILE "__ROOT__\src-tauri\resources\asr\model\streaming_config.json" "asr\model\streaming_config.json"
SectionEnd
'@
$taskScript=$taskScript.Replace('__QA__',$taskQa).Replace('__ROOT__',$taskRoot)
[IO.File]::WriteAllText((Join-Path $taskQa 'test.nsi'),$taskScript,[Text.UTF8Encoding]::new($true))
& $taskCompiler /V2 (Join-Path $taskQa 'test.nsi')
if($LASTEXITCODE -ne 0){throw 'NSIS compilation failed'}
function Run-QA {$taskRun=Start-Process -FilePath (Join-Path $taskQa 'test.exe') -WindowStyle Hidden -Wait -PassThru;if($taskRun.ExitCode -ne 0){throw 'QA installer failed'}}
$taskFiles=@('asr/LICENSE.txt','asr/ONNX-LICENSE.txt','asr/NOTICE.txt','asr/model/streaming_config.json')
$taskDate=[DateTime]::SpecifyKind([DateTime]'2001-02-03T04:05:06',[DateTimeKind]::Utc)
Run-QA
foreach($taskFile in $taskFiles){[IO.File]::SetLastWriteTimeUtc((Join-Path $taskQa ('installed/'+$taskFile)),$taskDate)}
Run-QA
foreach($taskFile in $taskFiles){if([IO.File]::GetLastWriteTimeUtc((Join-Path $taskQa ('installed/'+$taskFile))) -ne $taskDate){throw "Valid resource was rewritten: $taskFile"}}
[IO.File]::WriteAllText((Join-Path $taskQa 'installed/asr/LICENSE.txt'),'corrupt')
Remove-Item -LiteralPath (Join-Path $taskQa 'installed/asr/model/streaming_config.json')
Run-QA
foreach($taskFile in $taskFiles){$taskSource=Join-Path $taskRoot ('src-tauri/resources/'+$taskFile);$taskTarget=Join-Path $taskQa ('installed/'+$taskFile);if((Get-FileHash -LiteralPath $taskSource).Hash -ne (Get-FileHash -LiteralPath $taskTarget).Hash){throw "Resource not repaired: $taskFile"}}
if([IO.File]::GetLastWriteTimeUtc((Join-Path $taskQa 'installed/asr/ONNX-LICENSE.txt')) -ne $taskDate){throw 'A valid license was rewritten while repairing another file'}
$taskReport=@{validResourcesReused=$true;changedLicenseRepaired=$true;missingModelConfigurationRestored=$true;unrelatedLicenseUntouched=$true;personalInstallationModified=$false}
$taskReport|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6262-installer-reuse.json') -Encoding UTF8
'PASS real NSIS fixture: first install, reuse with different timestamps, corrupt license repair, missing resource recovery; no personal installation touched'
