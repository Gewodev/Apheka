$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskStatus=Get-Content -LiteralPath (Join-Path $taskRoot 'release/build-6.26.6.status.json') -Raw|ConvertFrom-Json
if($taskStatus.state -ne 'complete' -or $taskStatus.exitCode -ne 0){throw 'Build not complete'}
$taskMeta=Get-Content -LiteralPath (Join-Path $taskRoot 'release/pohu_FINAL.json') -Raw|ConvertFrom-Json
if($taskMeta.product -ne 'POHU' -or $taskMeta.version -ne '6.26.6'){throw 'Wrong product/version'}
$reports=@('qa-6266-ui.json','qa-6266-compatible-pointer.json','qa-6266-music-traversal.json','qa-6266-floating-timer.json','qa-6266-scroll.json')
foreach($report in $reports){$value=Get-Content -LiteralPath (Join-Path $taskRoot ('release/'+$report)) -Raw|ConvertFrom-Json;if(@($value.errors).Count){throw "Failed report: $report"}}
$views=Get-Content -LiteralPath (Join-Path $taskRoot 'release/qa-6266-sections.json') -Raw|ConvertFrom-Json
if(@($views|Where-Object performance).Count -ne 10){throw 'Production view checks incomplete'}
$target=Join-Path $taskRoot 'release/POHU_6.26.6_Instalador_x64.exe'
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/pohu_FINAL.exe') -Destination $target -Force
$binary=Get-Item -LiteralPath $target;$hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if($hash -ne $taskMeta.sha256 -or $binary.Length -ne $taskMeta.bytes -or $binary.VersionInfo.ProductVersion -ne '6.26.6' -or $binary.VersionInfo.ProductName -ne 'POHU'){throw 'Installer verification failed'}
$taskMeta.file=$binary.Name
$taskMeta|Add-Member -NotePropertyName build -NotePropertyValue $taskStatus
$taskMeta|Add-Member -NotePropertyName qaReports -NotePropertyValue ($reports+@('qa-6266-sections.json','qa-6266-public-services.log','qa-6266-installer-hooks.log','qa-6266-installer-reuse.log'))
$taskMeta|Add-Member -NotePropertyName physicalCursorValidation -NotePropertyValue 'Not completed in this revision: user stopped Computer Use with Escape. No personal installation changes.'
$taskMeta|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/POHU-release-6.26.6.json') -Encoding utf8
$taskMeta|Select-Object product,version,file,bytes,sha256
