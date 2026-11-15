param(
  [string]$Version = '6.27.1',
  [string]$Notes = '',
  [switch]$SkipBuild
)

# Publica una versión de West en GitHub Releases con el auto-actualizador.
#
#   1. Compila el instalador NSIS y genera los artefactos firmados
#      (latest.json + .nsis.zip) usando la clave privada.
#   2. Crea (o actualiza) la etiqueta y el release en GitHub.
#   3. Sube el instalador, el paquete firmado y el manifiesto latest.json.
#
# La app consulta  https://github.com/Gewodev/Apheka/releases/latest/download/latest.json
# y por eso el release debe existir con ese archivo y el repositorio debe ser
# público (o el usuario debe estar autenticado en GitHub).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$keyPath = Join-Path $root '.west-signing\west.key'
$keyPassword = Join-Path $root '.west-signing\west.key.password'
if (-not (Test-Path $keyPath)) { throw "Falta la clave privada: $keyPath" }
$password = if (Test-Path $keyPassword) { (Get-Content $keyPassword -Raw).Trim() } else { '' }

if (-not $SkipBuild) {
  # El CLI de Tauri lee la clave desde TAURI_SIGNING_PRIVATE_KEY (contenido) y
  # la contraseña desde TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
  $env:TAURI_SIGNING_PRIVATE_KEY = [IO.File]::ReadAllText($keyPath)
  if ($password) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $password }
  Write-Output "Compilando West $Version con artefactos de actualizacion..."
  pnpm tauri build --config src-tauri/tauri.prod.conf.json --config src-tauri/tauri.ci.conf.json --bundles nsis
  if ($LASTEXITCODE -ne 0) { throw 'La compilacion del instalador fallo.' }
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

$bundle = Join-Path $root "src-tauri\target\release\bundle\nsis"
$installer = Join-Path $bundle "West_${Version}_x64-setup.exe"
$signed = Join-Path $bundle "West_${Version}_x64-setup.exe.nsis.zip"
$manifest = Join-Path $bundle 'latest.json'
if (-not (Test-Path $installer)) { throw "No se encontro el instalador: $installer" }

$assets = @($installer)
if (Test-Path $signed) { $assets += $signed }
if (Test-Path $manifest) { $assets += $manifest } else { throw "No se encontro latest.json (falta la firma)." }

$tag = "v$Version"
$body = if ($Notes) { $Notes } else { @"
West $Version.

La app comprueba este release al arrancar y ofrece "Actualizar" dentro de la
propia aplicacion. Los datos del usuario (notas, cursos, musica y actividad)
se conservan durante la actualizacion.
"@ }

gh release view $tag --repo Gewodev/Apheka *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "La etiqueta $tag ya existe: se actualizan los assets."
  gh release upload $tag $assets --repo Gewodev/Apheka --clobber
  gh release edit $tag --repo Gewodev/Apheka --title "West $Version" --notes $body
} else {
  Write-Output "Creando la etiqueta y el release $tag..."
  gh release create $tag $assets --repo Gewodev/Apheka --title "West $Version" --notes $body --target main
}

# El manifiesto local se regenera con el hash real del instalador publicado.
& (Join-Path $PSScriptRoot 'update-west-manifest.ps1') -Version $Version

Write-Output ''
Write-Output "Release publicado: https://github.com/Gewodev/Apheka/releases/tag/$tag"
Write-Output "Manifiesto:          https://github.com/Gewodev/Apheka/releases/latest/download/latest.json"
