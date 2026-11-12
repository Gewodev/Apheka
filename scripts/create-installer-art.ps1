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
function Draw-Pouh($graphics,$color,[single]$x,[single]$y,[single]$scale) {
  $state=$graphics.Save();$graphics.TranslateTransform($x,$y);$graphics.ScaleTransform($scale,$scale)
  $pen=[Drawing.Pen]::new($color,3.4);$pen.StartCap=$pen.EndCap=[Drawing.Drawing2D.LineCap]::Round
  try {
    $graphics.DrawLine($pen,1,28,1,1);$graphics.DrawLine($pen,1,1,12,1);$graphics.DrawArc($pen,4,1,17,16,270,180);$graphics.DrawLine($pen,12,17,1,17)
    $graphics.DrawEllipse($pen,31,1,22,27)
    $graphics.DrawLine($pen,65,1,65,17);$graphics.DrawArc($pen,65,6,22,22,0,180);$graphics.DrawLine($pen,87,17,87,1)
    $graphics.DrawLine($pen,100,1,100,28);$graphics.DrawLine($pen,122,1,122,28);$graphics.DrawLine($pen,100,14,122,14)
  } finally {$pen.Dispose();$graphics.Restore($state)}
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
          Draw-Pouh $g $light.Color 22 99 1.0
          $g.FillRectangle($accent, 23, 136, 22, 3)
          $g.DrawString("Tu espacio.`nA tu ritmo.", $label, $light, [Drawing.RectangleF]::new(20, 155, 128, 55))
          $g.DrawString('Estudio, Charvis y música', $caption, $muted, [Drawing.RectangleF]::new(21, 218, 124, 32))
          $g.DrawLine($line, 23, 259, 141, 259)
          $g.DrawString(('POUH ' + $version), $small, $light, 20, 269)
          $g.DrawString('Hecho por Gewodev', $caption, $muted, 21, 292)
        } finally { $light.Dispose(); $caption.Dispose() }
      } else {
        $headerName = [Drawing.Font]::new('Segoe UI', 16, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
        $caption = [Drawing.Font]::new('Segoe UI', 9, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        try {
          $g.DrawImage($logo, 8, 13, 30, 30)
          Draw-Pouh $g $ink.Color 45 13 0.64
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
Write-Output 'POUH installer artwork generated; original logo preserved.'
