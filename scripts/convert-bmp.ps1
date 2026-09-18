Add-Type -AssemblyName System.Drawing

$srcSidePath = "C:\Users\nidal\.gemini\antigravity\brain\cb51dc74-e37f-4550-87c4-6679178966ef\installer_sidebar_orange_1787079751567.jpg"
$srcHeadPath = "C:\Users\nidal\.gemini\antigravity\brain\cb51dc74-e37f-4550-87c4-6679178966ef\installer_header_orange_1787079784072.jpg"

# 1. Sidebar (164x314)
$srcSide = [System.Drawing.Image]::FromFile($srcSidePath)
$bmpSide = New-Object System.Drawing.Bitmap 164, 314
$g1 = [System.Drawing.Graphics]::FromImage($bmpSide)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.DrawImage($srcSide, 0, 0, 164, 314)
$g1.Dispose()
$srcSide.Dispose()

$bmpSide.Save("C:\Users\nidal\Desktop\iptv player\build\installerSidebar.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmpSide.Save("C:\Users\nidal\Desktop\iptv player\build\uninstallerSidebar.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmpSide.Dispose()

# 2. Header (150x57)
$srcHead = [System.Drawing.Image]::FromFile($srcHeadPath)
$bmpHead = New-Object System.Drawing.Bitmap 150, 57
$g2 = [System.Drawing.Graphics]::FromImage($bmpHead)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.DrawImage($srcHead, 0, 0, 150, 57)
$g2.Dispose()
$srcHead.Dispose()

$bmpHead.Save("C:\Users\nidal\Desktop\iptv player\build\installerHeader.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmpHead.Dispose()

Write-Host "True 24-bit NSIS BMP images generated successfully."
