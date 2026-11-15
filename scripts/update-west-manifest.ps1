param(
  [string]$Version = '6.27.1'
)

# Publica el instalador NSIS como release/west_FINAL.exe y actualiza el
# manifiesto release/west_FINAL.json con tamaño, SHA-256 y recursos incrustados.

$root = Split-Path -Parent $PSScriptRoot
$bundle = Join-Path $root "src-tauri\target\release\bundle\nsis\West_${Version}_x64-setup.exe"
$target = Join-Path $root 'release\west_FINAL.exe'
$manifestPath = Join-Path $root 'release\west_FINAL.json'

if (-not (Test-Path $bundle)) { throw "No se encontró el instalador: $bundle" }

Copy-Item -LiteralPath $bundle -Destination $target -Force
$bytes = (Get-Item $target).Length
$sha = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash

$assets = @()
$distAssets = Join-Path $root 'dist\assets'
if (Test-Path $distAssets) {
  $assets = Get-ChildItem $distAssets -File | Where-Object { $_.Name -match '^(index|charts|anim|tauri|storage|audio-meta|date)-.*\.(js|css)$' } | Sort-Object Name | ForEach-Object { "assets/$($_.Name)" }
}

$existing = @{}
if (Test-Path $manifestPath) { try { $existing = Get-Content $manifestPath -Raw | ConvertFrom-Json } catch { $existing = @{} } }

$manifest = [ordered]@{
  version                 = $Version
  embeddedFrontendAssets  = $assets
  file                    = 'west_FINAL.exe'
  legacyUpgrade           = 'Exact NSIS product identities and MSI upgrade GUIDs; /UPDATE preserves AppData'
  dataDirectory           = 'com.owa.studio (existing desktop data directory retained)'
  manifestRewrittenBeforeFrontend = $false
  executable              = 'West.exe'
  product                 = 'West'
  buildCommand            = 'pnpm tauri build --config src-tauri/tauri.prod.conf.json --bundles nsis'
  bytes                   = $bytes
  sha256                  = $sha
  sourceLatestEditUtc     = (Get-Date).ToUniversalTime().ToString('o')
  modifiedAtUtc           = (Get-Item $target).LastWriteTimeUtc.ToString('o')
  identifier              = 'com.owa.studio'
  updater                 = 'GitHub Releases (tauri-plugin-updater 2.12.0); pubkey embebida en plugins.updater'
}

$json = $manifest | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText($manifestPath, $json, (New-Object Text.UTF8Encoding($false)))
Write-Output "release/west_FINAL.exe  $bytes bytes  sha256 $sha"
