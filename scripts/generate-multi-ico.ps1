Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\nidal\Desktop\iptv player\assets\logo.png"
$icoPath = "C:\Users\nidal\Desktop\iptv player\build\icon.ico"
$assetsIcoPath = "C:\Users\nidal\Desktop\iptv player\assets\icon.ico"

$srcImage = [System.Drawing.Image]::FromFile($srcPath)
$sizes = @(16, 32, 48, 64, 128, 256)

$streams = @()
$pngBuffers = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImage, 0, 0, $size, $size)
    $g.Dispose()
    
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBuffers += ,($ms.ToArray())
    $ms.Dispose()
    $bmp.Dispose()
}
$srcImage.Dispose()

# Create multi-image ICO binary
$count = $sizes.Count
$headerSize = 6 + (16 * $count)

$outStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $outStream

# ICONDIR header
$writer.Write([UInt16]0) # Reserved
$writer.Write([UInt16]1) # Type 1 = ICO
$writer.Write([UInt16]$count) # Number of images

$offset = $headerSize
for ($i = 0; $i -lt $count; $i++) {
    $s = $sizes[$i]
    $b = $pngBuffers[$i]
    $wByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $hByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    
    $writer.Write($wByte) # Width
    $writer.Write($hByte) # Height
    $writer.Write([byte]0) # Colors
    $writer.Write([byte]0) # Reserved
    $writer.Write([UInt16]1) # Color planes
    $writer.Write([UInt16]32) # Bits per pixel
    $writer.Write([UInt32]$b.Length) # Image size in bytes
    $writer.Write([UInt32]$offset) # Image offset
    
    $offset += $b.Length
}

for ($i = 0; $i -lt $count; $i++) {
    $writer.Write($pngBuffers[$i])
}

$writer.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $outStream.ToArray())
[System.IO.File]::WriteAllBytes($assetsIcoPath, $outStream.ToArray())
$writer.Dispose()
$outStream.Dispose()

Write-Host "Multi-resolution icon.ico created successfully at $icoPath with $count sizes."
