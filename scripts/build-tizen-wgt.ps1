# Package Samsung Tizen .wgt Application & USB UserWidget
$ErrorActionPreference = "Stop"

$tizenDir = "C:\Users\nidal\Desktop\iptv player\tizen-app"
$distDir = "C:\Users\nidal\Desktop\iptv player\dist"
$wgtPath = Join-Path $distDir "Nidalplayer-Tizen-3.7.1.wgt"
$usbDir = Join-Path $distDir "userwidget"

if (!(Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir -Force | Out-Null }
if (!(Test-Path $usbDir)) { New-Item -ItemType Directory -Path $usbDir -Force | Out-Null }

if (Test-Path $wgtPath) { Remove-Item -Path $wgtPath -Force }

$tempZip = Join-Path $distDir "temp_tizen.zip"
if (Test-Path $tempZip) { Remove-Item -Path $tempZip -Force }

Write-Host "Packaging Tizen files from $tizenDir..."
Compress-Archive -Path "$tizenDir\*" -DestinationPath $tempZip -Force

Rename-Item -Path $tempZip -NewName "Nidalplayer-Tizen-3.7.1.wgt" -Force
Copy-Item -Path $wgtPath -Destination (Join-Path $usbDir "Nidalplayer.wgt") -Force

Write-Host "Samsung Tizen WGT package created successfully."
Write-Host "WGT Package:" $wgtPath
Write-Host "USB UserWidget:" (Join-Path $usbDir "Nidalplayer.wgt")
