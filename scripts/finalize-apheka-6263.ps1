$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskStatus=Get-Content -LiteralPath (Join-Path $taskRoot 'release/build-6.26.3.status.json') -Raw | ConvertFrom-Json
if($taskStatus.state -ne 'complete' -or $taskStatus.exitCode -ne 0){throw 'Build has not completed successfully'}
$taskMeta=Get-Content -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.json') -Raw | ConvertFrom-Json
if($taskMeta.version -ne '6.26.3'){throw 'Unexpected installer version'}
$taskReports=@('qa-6263-pointer-resume.json')
foreach($taskReport in $taskReports){
  $taskData=Get-Content -LiteralPath (Join-Path $taskRoot ('release/'+$taskReport)) -Raw | ConvertFrom-Json
  if(@($taskData.errors).Count -gt 0 -or @($taskData.checks).Count -lt 6){throw "Incomplete or failed QA: $taskReport"}
}
$taskTarget=Join-Path $taskRoot 'release/APHEKA_6.26.3_Instalador_x64.exe'
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.exe') -Destination $taskTarget
$taskBinary=Get-Item -LiteralPath $taskTarget
$taskHash=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash
if($taskHash -ne $taskMeta.sha256 -or $taskBinary.Length -ne $taskMeta.bytes -or $taskBinary.VersionInfo.ProductVersion -ne '6.26.3'){throw 'Installer integrity or version mismatch'}
$taskMeta.file=$taskBinary.Name
$taskMeta|Add-Member -NotePropertyName build -NotePropertyValue $taskStatus
$taskMeta|Add-Member -NotePropertyName qaReports -NotePropertyValue $taskReports
$taskMeta|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/APHEKA-release-6.26.3.json') -Encoding UTF8
$taskMeta|Select-Object version,file,bytes,sha256
