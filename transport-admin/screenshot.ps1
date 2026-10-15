Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$width = $screen.Bounds.Width
$height = $screen.Bounds.Height

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(0, 0, 0, 0, (New-Object System.Drawing.Size($width, $height)))

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "screenshot_$timestamp.png"
$bitmap.Save($filename)

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Screenshot saved as: $filename"