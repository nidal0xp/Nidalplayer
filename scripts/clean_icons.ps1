Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\nidal\Desktop\iptv player\assets\logo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $bmp.Width
$h = $bmp.Height

Write-Output "Original Size: $w x $h"

# Create a clean bitmap with solid Obsidian Background (#080A0E)
$cleanBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($cleanBmp)
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 8, 10, 14))
$g.FillRectangle($bgBrush, 0, 0, $w, $h)

# Copy pixels, but if pixel is outside/white/light corner (R > 180, G > 180, B > 180), replace with #080A0E
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -gt 180 -and $p.G -gt 180 -and $p.B -gt 180) {
            # Replace white corner with Obsidian #080A0E
            $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 8, 10, 14))
        } else {
            $cleanBmp.SetPixel($x, $y, $p)
        }
    }
}

$bmp.Dispose()
$g.Dispose()

# Create standard 512x512 scaled version with smooth anti-aliasing
$final512 = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g512 = [System.Drawing.Graphics]::FromImage($final512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g512.DrawImage($cleanBmp, 0, 0, 512, 512)
$g512.Dispose()
$cleanBmp.Dispose()

# Verify top-left corner is now solid #080A0E
$corner = $final512.GetPixel(0, 0)
Write-Output "Cleaned Top-Left Pixel: $($corner.ToString())"

# Target Destinations
$targets = @(
    "C:\Users\nidal\Desktop\iptv player\assets\logo.png",
    "C:\Users\nidal\Desktop\iptv player\assets\icon.png",
    "C:\Users\nidal\Desktop\iptv player\android-tv\res\drawable\ic_launcher.png",
    "C:\Users\nidal\Desktop\iptv player\android-tv\assets\www\icon.png",
    "C:\Users\nidal\Desktop\iptv player\android-mobile\res\drawable\ic_launcher.png",
    "C:\Users\nidal\Desktop\iptv player\android-mobile\assets\www\icon.png"
)

foreach ($t in $targets) {
    $dir = [System.IO.Path]::GetDirectoryName($t)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $final512.Save($t, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Updated: $t"
}

# Create .ico for Windows Desktop
# Convert 256x256 bitmap to ICO
$bmp256 = New-Object System.Drawing.Bitmap(256, 256)
$g256 = [System.Drawing.Graphics]::FromImage($bmp256)
$g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g256.DrawImage($final512, 0, 0, 256, 256)
$g256.Dispose()

$hIcon = $bmp256.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoStream = [System.IO.File]::OpenWrite("C:\Users\nidal\Desktop\iptv player\assets\icon.ico")
$icon.Save($icoStream)
$icoStream.Dispose()
$icon.Dispose()
$bmp256.Dispose()

Copy-Item "C:\Users\nidal\Desktop\iptv player\assets\icon.ico" "C:\Users\nidal\Desktop\iptv player\build\icon.ico" -Force -ErrorAction SilentlyContinue

$final512.Dispose()
Write-Output "ALL ICONS CLEANED AND UNIFIED ACROSS ALL VERSIONS!"
