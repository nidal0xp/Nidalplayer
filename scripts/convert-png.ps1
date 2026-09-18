Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\assets\logo.png"
$resDir = Join-Path $PSScriptRoot "..\android-tv\res\drawable"

$img = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))

# Save 192x192 PNG
$icBmp = New-Object System.Drawing.Bitmap 192, 192
$g1 = [System.Drawing.Graphics]::FromImage($icBmp)
$g1.DrawImage($img, 0, 0, 192, 192)
$g1.Dispose()
$icBmp.Save((Join-Path $resDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$icBmp.Dispose()

# Save 320x180 TV Banner PNG
$bannerBmp = New-Object System.Drawing.Bitmap 320, 180
$g2 = [System.Drawing.Graphics]::FromImage($bannerBmp)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 8, 10, 14))
$g2.FillRectangle($brush, 0, 0, 320, 180)
$brush.Dispose()
$g2.DrawImage($img, 70, 0, 180, 180)
$g2.Dispose()
$bannerBmp.Save((Join-Path $resDir "tv_banner.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bannerBmp.Dispose()

$img.Dispose()
Write-Host "Real PNG files generated in $resDir"
