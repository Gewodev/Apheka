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
$name = [Drawing.Font]::new('Segoe UI', 22, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$small = [Drawing.Font]::new('Segoe UI', 11, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$label = [Drawing.Font]::new('Segoe UI', 15, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
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
          $g.DrawString('APHEKA', $name, $light, 20, 98)
          $g.FillRectangle($accent, 23, 136, 22, 3)
          $g.DrawString("Tu espacio.`nA tu ritmo.", $label, $light, [Drawing.RectangleF]::new(20, 155, 128, 55))
          $g.DrawString('Estudio, Charvis y música', $caption, $muted, [Drawing.RectangleF]::new(21, 218, 124, 32))
          $g.DrawLine($line, 23, 259, 141, 259)
          $g.DrawString(('APHEKA ' + $version), $small, $light, 20, 269)
          $g.DrawString('Hecho por Gewodev', $caption, $muted, 21, 292)
        } finally { $light.Dispose(); $caption.Dispose() }
      } else {
        $headerName = [Drawing.Font]::new('Segoe UI', 16, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
        $caption = [Drawing.Font]::new('Segoe UI', 9, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        try {
          $g.DrawImage($logo, 8, 13, 30, 30)
          $g.DrawString('APHEKA', $headerName, $ink, 45, 11)
          $g.DrawString(('Escritorio · ' + $version), $caption, $muted, 46, 33)
        } finally { $headerName.Dispose(); $caption.Dispose() }
      }
      $bitmap.Save((Join-Path $out ($kind + '.bmp')), [Drawing.Imaging.ImageFormat]::Bmp)
    } finally { $g.Dispose(); $bitmap.Dispose() }
  }
} finally {
  $logo.Dispose(); $ink.Dispose(); $muted.Dispose(); $accent.Dispose(); $line.Dispose()
  $name.Dispose(); $small.Dispose(); $label.Dispose()
}
Write-Output 'APHEKA installer artwork generated; original logo preserved.'
