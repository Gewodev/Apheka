$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskStatus=Get-Content -LiteralPath (Join-Path $taskRoot 'release/build-6.26.4.status.json') -Raw | ConvertFrom-Json
if($taskStatus.state -ne 'complete' -or $taskStatus.exitCode -ne 0){throw 'Build has not completed successfully'}
$taskMeta=Get-Content -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.json') -Raw | ConvertFrom-Json
if($taskMeta.version -ne '6.26.4'){throw 'Unexpected installer version'}
$taskReports=@('qa-6264-pointer-resume.json','qa-6264-native-timer-close.json')
foreach($taskReport in $taskReports){
  $taskData=Get-Content -LiteralPath (Join-Path $taskRoot ('release/'+$taskReport)) -Raw | ConvertFrom-Json
  if(@($taskData.errors).Count -gt 0){throw "Failed QA: $taskReport"}
}
$taskNative=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6264-native-timer-close.json') -Raw | ConvertFrom-Json
if(@($taskNative.samples).Count -lt 9){throw 'Native timer close checks incomplete'}
$taskCursorChecks=@($taskNative.samples | Where-Object {$_.cursorChecked -eq $true -and $_.flags -eq 1 -and $_.cursor -ne 0 -and $_.focused -eq $true})
if($taskCursorChecks.Count -lt 6){throw 'Focused native cursor visibility checks incomplete'}
$taskFlow=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6264-pointer-resume.json') -Raw | ConvertFrom-Json
if(@($taskFlow.checks).Count -lt 8){throw 'Input lifecycle checks incomplete'}
$taskTarget=Join-Path $taskRoot 'release/APHEKA_6.26.4_Instalador_x64.exe'
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.exe') -Destination $taskTarget
$taskBinary=Get-Item -LiteralPath $taskTarget
$taskHash=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash
if($taskHash -ne $taskMeta.sha256 -or $taskBinary.Length -ne $taskMeta.bytes -or $taskBinary.VersionInfo.ProductVersion -ne '6.26.4'){throw 'Installer integrity or version mismatch'}
$taskMeta.file=$taskBinary.Name
$taskMeta|Add-Member -NotePropertyName build -NotePropertyValue $taskStatus
$taskMeta|Add-Member -NotePropertyName qaReports -NotePropertyValue $taskReports
$taskMeta|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/APHEKA-release-6.26.4.json') -Encoding UTF8
$taskMeta|Select-Object version,file,bytes,sha256
