# Nidalplayer 1-Click Samsung Smart TV Wi-Fi Installer
param (
    [string]$TvIp = ""
)

Write-Host "=========================================================="
Write-Host " NIDALPLAYER — SAMSUNG SMART TV DIRECT INSTALLER"
Write-Host "=========================================================="

if (-not $TvIp) {
    $TvIp = Read-Host "Enter your Samsung TV IP Address (e.g. 192.168.11.xxx)"
}

if (-not $TvIp) {
    Write-Host "No TV IP provided. Exiting."
    exit 1
}

Write-Host "Connecting to Samsung TV at $TvIp..."
$tizenCli = Get-Command "tizen" -ErrorAction SilentlyContinue

if ($tizenCli) {
    & tizen connect $TvIp
    Write-Host "Installing Nidalplayer.wgt to TV..."
    & tizen install -n "C:\Users\nidal\Desktop\iptv player\dist\Nidalplayer-Tizen-3.7.1.wgt" -t $TvIp
} else {
    $sdbCli = Get-Command "sdb" -ErrorAction SilentlyContinue
    if ($sdbCli) {
        & sdb connect $TvIp
        & sdb install "C:\Users\nidal\Desktop\iptv player\dist\Nidalplayer-Tizen-3.7.1.wgt"
    } else {
        Write-Host "Tizen CLI/SDB not found in PATH."
        Write-Host "Use the USB method below with the updated userwidget folder."
    }
}
