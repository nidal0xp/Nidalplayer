@echo off
if exist "%~dp0dist\Nidalplayer-Portable.exe" (
    start "" "%~dp0dist\Nidalplayer-Portable.exe"
) else (
    start "" "%~dp0dist\win-unpacked\Nidalplayer.exe"
)
