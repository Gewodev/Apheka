param([switch]$Build)
$ErrorActionPreference = 'Stop'
function Get-ArtifactSha256([string]$Path) {
  $algorithm=[Security.Cryptography.SHA256]::Create()
  $stream=[IO.File]::OpenRead($Path)
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','') }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}
function Get-SourceSignature {
  $files = @(& rg --files src public src-tauri/src src-tauri/installer-assets src-tauri/resources/asr) + @('src-tauri/asr-manifest.json','src-tauri/tauri.conf.json','src-tauri/tauri.prod.conf.json','src-tauri/installer-hooks.nsh','src-tauri/installer-tools.nsh','src-tauri/installer-template.nsi','src-tauri/capabilities/default.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','tsconfig.node.json')
  return [string]::Join("`n", @($files | Sort-Object | ForEach-Object { $_ + ':' + (Get-ArtifactSha256 (Join-Path $repo $_)) }))
}
function Get-ToolSignature {
  $entries=@('ffmpeg','ffprobe','yt-dlp') | ForEach-Object {
    $_ + ':' + (Get-ArtifactSha256 (Join-Path $repo "src-tauri/bin/$_-x86_64-pc-windows-msvc.exe"))
  }
  return [string]::Join("`n",$entries)
}
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $repo
try {
  if ($Build) {
    & (Join-Path $PSScriptRoot 'create-installer-art.ps1')
    $asr=Get-Content -LiteralPath (Join-Path $repo 'src-tauri/asr-manifest.json') -Raw | ConvertFrom-Json
    foreach($entry in $asr.files){$resource=Join-Path $repo ('src-tauri/resources/asr/'+$entry.file);if(!(Test-Path -LiteralPath $resource) -or (Get-ArtifactSha256 $resource) -ne $entry.sha256.ToUpperInvariant()){throw 'Offline dictation resource missing or corrupted; run scripts/prepare-local-asr.py'}}
    & (Join-Path $PSScriptRoot 'update-tool-hashes.ps1')
    $sourceBeforeBuild = Get-SourceSignature
    $toolsBeforeBuild = Get-ToolSignature
    & pnpm tauri build --config src-tauri/tauri.prod.conf.json --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw 'Build failed; no final package was published' }
  }
  $config = Get-Content -LiteralPath (Join-Path $repo 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
  $version = $config.version
  $product = $config.productName
  $prefix = $product.ToLowerInvariant()
  $source = Join-Path $repo "src-tauri/target/release/bundle/nsis/${product}_${version}_x64-setup.exe"
  $binary = Get-Item -LiteralPath $source
  if ($binary.VersionInfo.ProductName -ne $product -or $binary.VersionInfo.ProductVersion -ne $version) { throw 'Installer version mismatch' }
  $sourceFiles = @(& rg --files src public src-tauri/src src-tauri/installer-assets src-tauri/resources/asr) + @('src-tauri/asr-manifest.json','src-tauri/tauri.conf.json','src-tauri/tauri.prod.conf.json','src-tauri/installer-hooks.nsh','src-tauri/installer-tools.nsh','src-tauri/installer-template.nsi','src-tauri/capabilities/default.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','tsconfig.node.json')
  $latestSource = ($sourceFiles | ForEach-Object { (Get-Item -LiteralPath (Join-Path $repo $_)).LastWriteTimeUtc } | Sort-Object -Descending | Select-Object -First 1)
  $manifestRewrittenBeforeFrontend=$false
  if ($Build) {
    if ((Get-ToolSignature) -ne $toolsBeforeBuild) { throw 'A tool changed during compilation; rebuild before publishing' }
    $sourceAfterBuild=Get-SourceSignature
    if ($sourceAfterBuild -ne $sourceBeforeBuild) {
      $changedOutsideManifest=@(Compare-Object ($sourceBeforeBuild -split "`n") ($sourceAfterBuild -split "`n") | Where-Object { $_.InputObject -notlike 'src-tauri/Cargo.toml:*' })
      $cargoTime=@('src-tauri/Cargo.toml','src-tauri/Cargo.lock','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','tsconfig.node.json') | ForEach-Object { (Get-Item -LiteralPath (Join-Path $repo $_)).LastWriteTimeUtc } | Sort-Object -Descending | Select-Object -First 1
      $frontendTime=(Get-Item -LiteralPath (Join-Path $repo 'dist/index.html')).LastWriteTimeUtc
      if ($changedOutsideManifest.Count -gt 0 -or $cargoTime -gt $frontendTime) { throw 'Source changed during compilation; rebuild the completed revision before publishing' }
      $manifestRewrittenBeforeFrontend=$true
    }
  }
  if ($binary.LastWriteTimeUtc -lt $latestSource) { throw 'Source is newer than the installer; rebuild before publishing' }
  $html = [IO.File]::ReadAllText((Join-Path $repo 'dist/index.html'))
  $assets = @([regex]::Matches($html, '(?:src|href)="/([^\"]+\.(?:css|js))"') | ForEach-Object { $_.Groups[1].Value })
  $embedded = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes((Join-Path $repo 'src-tauri/target/release/owa-studio.exe')))
  if ($assets.Count -eq 0) { throw 'Production frontend has no assets' }
  foreach ($asset in $assets) { if (-not $embedded.Contains($asset)) { throw "Executable contains an old frontend: $asset is missing" } }
  $release = [IO.Path]::GetFullPath((Join-Path $repo 'release'))
  if (-not $release.StartsWith($repo + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid output directory' }
  $null = New-Item -ItemType Directory -Force -Path $release
  $final = Join-Path $release ($prefix+'_FINAL.exe')
  $sourceHash = Get-ArtifactSha256 $source
  $existingHash = if (Test-Path -LiteralPath $final) { Get-ArtifactSha256 $final } else { '' }
  if ($existingHash -ne $sourceHash) { Copy-Item -LiteralPath $source -Destination $final -Force }
  $finalHash = Get-ArtifactSha256 $final
  if ($sourceHash -ne $finalHash) { throw 'Copied installer hash mismatch' }
  $manifest = [ordered]@{
    product=$product;version=$version;identifier=$config.identifier
    file=($prefix+'_FINAL.exe');bytes=(Get-Item -LiteralPath $final).Length;sha256=$finalHash
    modifiedAtUtc=$binary.LastWriteTimeUtc.ToString('o');sourceLatestEditUtc=$latestSource.ToString('o')
    manifestRewrittenBeforeFrontend=$manifestRewrittenBeforeFrontend
    buildCommand='pnpm tauri build --config src-tauri/tauri.prod.conf.json --bundles nsis'
    embeddedFrontendAssets=$assets
    legacyUpgrade='Exact NSIS product identities and MSI upgrade GUIDs; /UPDATE preserves AppData'
    dataDirectory='com.owa.studio (existing desktop data directory retained)'
  }
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $release ($prefix+'_FINAL.json')) -Encoding UTF8
  $manifest | ConvertTo-Json -Depth 4
} finally { Pop-Location }
