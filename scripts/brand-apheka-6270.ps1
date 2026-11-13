$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8=New-Object System.Text.UTF8Encoding($false)
function Replace-InFile([string]$Path,[string]$Old,[string]$New){
  if(!(Test-Path -LiteralPath $Path)){return 0}
  $text=[IO.File]::ReadAllText($Path)
  if($text.IndexOf($Old) -lt 0){return 0}
  $count=([regex]::Matches($text,[regex]::Escape($Old))).Count
  [IO.File]::WriteAllText($Path,$text.Replace($Old,$New),$utf8)
  return $count
}
$total=0
$files=New-Object System.Collections.Generic.List[string]
Get-ChildItem -LiteralPath (Join-Path $repo 'src') -Recurse -File -Include *.ts,*.tsx | ForEach-Object { $files.Add($_.FullName) }
$files.Add((Join-Path $repo 'index.html'))
Get-ChildItem -LiteralPath (Join-Path $repo 'src-tauri/src') -Recurse -File -Include *.rs | ForEach-Object { $files.Add($_.FullName) }
foreach($extra in @('src-tauri/installer-hooks.nsh','src-tauri/installer-template.nsi','scripts/create-installer-art.ps1','scripts/runtime-6267.html')){
  $full=Join-Path $repo $extra; if(Test-Path -LiteralPath $full){$files.Add($full)}
}
foreach($file in $files){
  $n=Replace-InFile $file 'POUH' 'APHEKA'
  if($n -gt 0){ $total+=$n; "{0,-70} {1}" -f $file.Substring($repo.Length+1),$n }
}
"TOTAL replacements: $total"
