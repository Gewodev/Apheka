param(
  [Parameter(Mandatory = $true)][string]$Version
)

# Fija la version en todos los manifiestos del proyecto (app, Tauri, paquete).
# Se usa antes de compilar un release para que el instalador, el manifiesto
# `latest.json` y la etiqueta de GitHub coincidan exactamente.

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Set-JsonVersion([string]$path, [string]$version, [string]$property = 'version') {
  $full = Join-Path $root $path
  if (-not (Test-Path $full)) { return }
  $raw = [IO.File]::ReadAllText($full)
  $json = $raw | ConvertFrom-Json
  if ($json.PSObject.Properties.Name -contains $property) {
    $json.$property = $version
    $text = $json | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($full, $text, $utf8)
    Write-Output "  $path -> $version"
  }
}

Write-Output "West $Version"
Set-JsonVersion 'src-tauri\tauri.conf.json' $Version
Set-JsonVersion 'src-tauri\tauri.prod.conf.json' $Version
Set-JsonVersion 'package.json' $Version
