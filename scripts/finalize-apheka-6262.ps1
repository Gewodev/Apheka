$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskStatus=Get-Content -LiteralPath (Join-Path $taskRoot 'release/build-6.26.2.status.json') -Raw | ConvertFrom-Json
if($taskStatus.state -ne 'complete' -or $taskStatus.exitCode -ne 0){throw 'Build has not completed successfully'}
$taskMeta=Get-Content -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.json') -Raw | ConvertFrom-Json
if($taskMeta.version -ne '6.26.2'){throw 'Unexpected installer version'}
$taskReports=@('qa-6262-installer-reuse.json','qa-6262-installer-routing.json','qa-6262-artist-separation.json','qa-6262-bruno-cleanup.json','qa-6262-tools-wallpaper.json','qa-6262-sections.json')
foreach($taskReport in $taskReports){
  $taskData=Get-Content -LiteralPath (Join-Path $taskRoot ('release/'+$taskReport)) -Raw | ConvertFrom-Json
  foreach($taskRow in @($taskData)){
    $taskErrors=$taskRow.PSObject.Properties['errors']
    if($null -ne $taskErrors -and $taskErrors.Value -and @($taskErrors.Value).Count -gt 0){throw "QA errors: $taskReport"}
  }
}
$taskTarget=Join-Path $taskRoot 'release/APHEKA_6.26.2_Instalador_x64.exe'
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.exe') -Destination $taskTarget
$taskBinary=Get-Item -LiteralPath $taskTarget
$taskHash=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash
if($taskHash -ne $taskMeta.sha256 -or $taskBinary.Length -ne $taskMeta.bytes -or $taskBinary.VersionInfo.ProductVersion -ne '6.26.2'){throw 'Installer integrity or version mismatch'}
$taskMeta.file=$taskBinary.Name
$taskMeta|Add-Member -NotePropertyName build -NotePropertyValue $taskStatus
$taskMeta|Add-Member -NotePropertyName qaReports -NotePropertyValue $taskReports
$taskMeta|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/APHEKA-release-6.26.2.json') -Encoding UTF8
$taskMeta|Select-Object version,file,bytes,sha256
