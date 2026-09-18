# Minimal Standalone Android Build Toolchain Setup
$buildDir = "$PSScriptRoot\..\build-tools\android"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$platformZip = "$buildDir\platform-33.zip"
$buildToolsZip = "$buildDir\build-tools-33.zip"

# 1. Download Android 33 Platform (android.jar)
if (-not (Test-Path "$buildDir\android-13\android.jar") -and -not (Test-Path "$buildDir\android-33\android.jar")) {
    Write-Host "Downloading android.jar (Android 13 / API 33)..."
    $platformUrl = "https://dl.google.com/android/repository/platform-33_r02.zip"
    curl.exe -L -o $platformZip $platformUrl
    Expand-Archive -Path $platformZip -DestinationPath $buildDir -Force
    Remove-Item $platformZip -Force -ErrorAction SilentlyContinue
}

# 2. Download Android Build Tools (aapt2, d8, zipalign)
if (-not (Test-Path "$buildDir\android-13\aapt2.exe") -and -not (Test-Path "$buildDir\android-33\aapt2.exe")) {
    Write-Host "Downloading Android Build-Tools (aapt2, d8, zipalign)..."
    $btUrl = "https://dl.google.com/android/repository/build-tools_r33.0.2-windows.zip"
    curl.exe -L -o $buildToolsZip $btUrl
    Expand-Archive -Path $buildToolsZip -DestinationPath $buildDir -Force
    Remove-Item $buildToolsZip -Force -ErrorAction SilentlyContinue
}

Write-Host "Android TV build toolchain ready in $buildDir"
