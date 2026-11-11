$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskStatus=Get-Content -LiteralPath (Join-Path $taskRoot 'release/build-6.26.5.status.json') -Raw | ConvertFrom-Json
if($taskStatus.state -ne 'complete' -or $taskStatus.exitCode -ne 0){throw 'Build has not completed successfully'}
$taskMeta=Get-Content -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.json') -Raw | ConvertFrom-Json
if($taskMeta.version -ne '6.26.5'){throw 'Unexpected installer version'}
$taskReports=@('qa-6265-native-lifecycle.json','qa-6265-fullscreen.json','qa-6265-close-retry.json','qa-6265-ui.json','qa-6265-import-ui.json','qa-6265-notification-actions.json','qa-6265-tools-wallpaper.json','qa-6265-scroll.json')
foreach($taskReport in $taskReports){$taskData=Get-Content -LiteralPath (Join-Path $taskRoot ('release/'+$taskReport)) -Raw | ConvertFrom-Json;if(@($taskData.errors).Count -gt 0){throw "Failed QA: $taskReport"}}
$taskNative=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6265-native-lifecycle.json') -Raw | ConvertFrom-Json
$taskFull=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6265-fullscreen.json') -Raw | ConvertFrom-Json
if(@($taskNative.samples).Count -ne 12 -or @($taskFull.samples).Count -ne 12){throw 'Native lifecycle checks incomplete'}
if(@($taskFull.samples | Where-Object {$_.fullscreen -ne $true -or $_.pointerInput -ne $true}).Count){throw 'Full-screen pointer input check failed'}
$taskUi=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6265-ui.json') -Raw | ConvertFrom-Json
if(@($taskUi.steps).Count -ne 11){throw 'UI workflows incomplete'}
$taskViews=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6265-sections.json') -Raw | ConvertFrom-Json
if(@($taskViews | Where-Object performance).Count -ne 10){throw 'Production view checks incomplete'}
$taskTarget=Join-Path $taskRoot 'release/APHEKA_6.26.5_Instalador_x64.exe'
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/apheka_FINAL.exe') -Destination $taskTarget -Force
$taskBinary=Get-Item -LiteralPath $taskTarget
$taskHash=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash
if($taskHash -ne $taskMeta.sha256 -or $taskBinary.Length -ne $taskMeta.bytes -or $taskBinary.VersionInfo.ProductVersion -ne '6.26.5'){throw 'Installer integrity or version mismatch'}
$taskMeta.file=$taskBinary.Name
$taskMeta|Add-Member -NotePropertyName build -NotePropertyValue $taskStatus
$taskMeta|Add-Member -NotePropertyName qaReports -NotePropertyValue ($taskReports+@('qa-6265-sections.json','qa-6265-playlist-public.json','qa-6265-public-status.json'))
$taskMeta|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/APHEKA-release-6.26.5.json') -Encoding UTF8
$taskMeta|Select-Object version,file,bytes,sha256
