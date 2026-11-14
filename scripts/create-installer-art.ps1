$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$out = Join-Path $repo 'src-tauri/installer-assets'
$version = (Get-Content -LiteralPath (Join-Path $repo 'src-tauri/tauri.conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$null = New-Item -ItemType Directory -Force -Path $out
$logo = [Drawing.Image]::FromFile((Join-Path $repo 'src-tauri/icons/128x128.png'))
$ink = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#252A2E'))
$muted = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#89928E'))
$accent = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#E11D48'))
$line = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#34393B'), 1)
$small = [Drawing.Font]::new('Segoe UI', 11, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$label = [Drawing.Font]::new('Segoe UI', 15, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)

# The wordmark uses the same family and weight as the app, so the installer
# and the interface read as one single identity.
$fonts = [Drawing.Text.PrivateFontCollection]::new()
$fonts.AddFontFile((Join-Path $repo 'public/fonts/inter-tight-0.ttf'))
$wordmarkFamily = $fonts.Families[0]
$wordmark = [Drawing.Font]::new($wordmarkFamily, 30, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$wordmarkSmall = [Drawing.Font]::new($wordmarkFamily, 19, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$tracking = 0.012

function Draw-Wordmark($graphics,$font,$color,[single]$x,[single]$y) {
  $state = $graphics.Save()
  $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $brush = [Drawing.SolidBrush]::new($color)
  $format = [Drawing.StringFormat]::GenericTypographic
  try {
    foreach ($char in 'West'.ToCharArray()) {
      $graphics.DrawString([string]$char, $font, $brush, $x, $y, $format)
      $measured = $graphics.MeasureString([string]$char, $font, [int]::MaxValue, $format)
      $x = $x + $measured.Width + ($font.Size * $tracking)
    }
  } finally { $brush.Dispose(); $graphics.Restore($state) }
}

try {
  foreach ($kind in @('sidebar', 'header')) {
    $width = if ($kind -eq 'sidebar') { 164 } else { 150 }
    $height = if ($kind -eq 'sidebar') { 314 } else { 57 }
    $bitmap = [Drawing.Bitmap]::new($width, $height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
      $g.Clear([Drawing.ColorTranslator]::FromHtml('#F3F5F2'))
      if ($kind -eq 'sidebar') {
        $g.Clear([Drawing.ColorTranslator]::FromHtml('#15191C'))
        $light = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#E9EDE9'))
        $caption = [Drawing.Font]::new('Segoe UI', 10, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        try {
          $g.DrawImage($logo, 22, 24, 58, 58)
          Draw-Wordmark $g $wordmark $light.Color 22 98
          $g.FillRectangle($accent, 23, 136, 22, 3)
          $g.DrawString("Tu espacio.`nA tu ritmo.", $label, $light, [Drawing.RectangleF]::new(20, 155, 128, 55))
          $g.DrawString('Estudio, Charvis y música', $caption, $muted, [Drawing.RectangleF]::new(21, 218, 124, 32))
          $g.DrawLine($line, 23, 259, 141, 259)
          $g.DrawString(('West ' + $version), $small, $light, 20, 269)
          $g.DrawString('Hecho por Gewodev', $caption, $muted, 21, 292)
        } finally { $light.Dispose(); $caption.Dispose() }
      } else {
        $caption = [Drawing.Font]::new('Segoe UI', 9, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        try {
          $g.DrawImage($logo, 8, 13, 30, 30)
          Draw-Wordmark $g $wordmarkSmall $ink.Color 45 12
          $g.DrawString(('Escritorio · ' + $version), $caption, $muted, 46, 35)
        } finally { $caption.Dispose() }
      }
      $bitmap.Save((Join-Path $out ($kind + '.bmp')), [Drawing.Imaging.ImageFormat]::Bmp)
    } finally { $g.Dispose(); $bitmap.Dispose() }
  }
} finally {
  $logo.Dispose(); $ink.Dispose(); $muted.Dispose(); $accent.Dispose(); $line.Dispose()
  $small.Dispose(); $label.Dispose(); $wordmark.Dispose(); $wordmarkSmall.Dispose(); $fonts.Dispose()
}
Write-Output 'West installer artwork generated; original logo preserved.'
