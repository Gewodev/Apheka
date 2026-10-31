param([switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskLog=Join-Path $taskRoot 'release/build-6.23.0.log'
$taskStatus=Join-Path $taskRoot 'release/build-6.23.0.status.json'
$taskStart=[DateTime]::UtcNow.ToString('o')
@{startedAtUtc=$taskStart;processId=$PID;state='running';mode=$(if($VerifyOnly){'verify_existing_bundle'}else{'build'})}|ConvertTo-Json|Set-Content -LiteralPath $taskStatus -Encoding UTF8
$taskResult=0
try {
  if($VerifyOnly){& (Join-Path $PSScriptRoot 'package-final.ps1')}
  else{& (Join-Path $PSScriptRoot 'package-final.ps1') -Build}
} catch {
  $taskResult=1
  Write-Output "Build failed: $($_.Exception.Message)"
}
@{startedAtUtc=$taskStart;finishedAtUtc=[DateTime]::UtcNow.ToString('o');processId=$PID;state=$(if($taskResult -eq 0){'complete'}else{'failed'});exitCode=$taskResult;mode=$(if($VerifyOnly){'verify_existing_bundle'}else{'build'})}|ConvertTo-Json|Set-Content -LiteralPath $taskStatus -Encoding UTF8
exit $taskResult
