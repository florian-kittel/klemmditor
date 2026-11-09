Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$iconDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'public/icons'

# Brick 2 × 2 from the editor: 10 units per stud, 12 units tall,
# with studs of radius 3 and height 1.5. Work in stud pitches.
$pitch = 125
$horizontal = $pitch / [Math]::Sqrt(2)
$depth = $pitch / [Math]::Sqrt(6)
$vertical = $pitch * [Math]::Sqrt(2 / 3)
$brickHeight = 1.2
$studHeight = 0.15
$studRadius = 0.3
$rearY = 256 - (4 * $depth + $brickHeight * $vertical) / 2

function Project([double]$x, [double]$y, [double]$z) {
    [System.Drawing.PointF]::new(
        (256 + ($x - $y) * $horizontal),
        ($rearY + ($x + $y) * $depth - $z * $vertical)
    )
}

function New-Brush([string]$hex) {
    [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Draw-Icon([string]$name, [int]$size, [switch]$fullBleed, [switch]$maskable) {
    $supersampled = $size * 4
    $canvas = [System.Drawing.Bitmap]::new($supersampled, $supersampled)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.ScaleTransform($supersampled / 512, $supersampled / 512)

    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new(0, 0, 512, 512),
        [System.Drawing.ColorTranslator]::FromHtml('#187762'),
        [System.Drawing.ColorTranslator]::FromHtml('#0d4f43'),
        65
    )
    if ($fullBleed -or $maskable) {
        $graphics.FillRectangle($background, 0, 0, 512, 512)
    } else {
        $tile = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $tile.AddArc(8, 8, 116, 116, 180, 90)
        $tile.AddArc(388, 8, 116, 116, 270, 90)
        $tile.AddArc(388, 388, 116, 116, 0, 90)
        $tile.AddArc(8, 388, 116, 116, 90, 90)
        $tile.CloseFigure()
        $graphics.FillPath($background, $tile)
        $tile.Dispose()
    }
    if ($maskable) {
        $graphics.TranslateTransform(72, 72)
        $graphics.ScaleTransform(0.71875, 0.71875)
    }

    $rear = Project 0 0 0
    $right = Project 2 0 0
    $front = Project 2 2 0
    $left = Project 0 2 0
    $rightBase = Project 2 0 (-$brickHeight)
    $frontBase = Project 2 2 (-$brickHeight)
    $leftBase = Project 0 2 (-$brickHeight)

    $shadowPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $shadowPath.AddEllipse(88, ($frontBase.Y - 99), 336, 124)
    $shadow = [System.Drawing.Drawing2D.PathGradientBrush]::new($shadowPath)
    $shadow.CenterColor = [System.Drawing.Color]::FromArgb(105, 4, 34, 30)
    $shadow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 4, 34, 30))
    $graphics.FillPath($shadow, $shadowPath)
    $shadow.Dispose()
    $shadowPath.Dispose()

    $leftFace = New-Brush '#c6dfd7'
    $rightFace = New-Brush '#90b9af'
    $topFace = New-Brush '#eff8f4'
    $studWall = New-Brush '#8eb9ac'
    $studTop = New-Brush '#ffffff'
    # The full outline under the faces prevents seams from antialiasing.
    $graphics.FillPolygon($rightFace, [System.Drawing.PointF[]]@(
        $rear, $right, $rightBase, $frontBase, $leftBase, $left
    ))
    $graphics.FillPolygon($leftFace, [System.Drawing.PointF[]]@(
        $left, $front, $frontBase, $leftBase
    ))
    $graphics.FillPolygon($topFace, [System.Drawing.PointF[]]@($rear, $right, $front, $left))

    # Project both the center and diameter of each cylinder from the same grid as the faces.
    $studWidth = 2 * $studRadius * $pitch
    $studDepth = $studWidth / [Math]::Sqrt(3)
    foreach ($cell in @(@(0.5, 0.5), @(1.5, 0.5), @(0.5, 1.5), @(1.5, 1.5))) {
        $base = Project $cell[0] $cell[1] 0
        $cap = Project $cell[0] $cell[1] $studHeight
        $ellipseX = $cap.X - $studWidth / 2
        $capY = $cap.Y - $studDepth / 2
        $baseY = $base.Y - $studDepth / 2
        $wall = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $wall.AddArc($ellipseX, $capY, $studWidth, $studDepth, 180, 180)
        $wall.AddArc($ellipseX, $baseY, $studWidth, $studDepth, 0, 180)
        $wall.CloseFigure()
        $graphics.FillPath($studWall, $wall)
        $graphics.FillEllipse($studTop, $ellipseX, $capY, $studWidth, $studDepth)
        $wall.Dispose()
    }

    $output = [System.Drawing.Bitmap]::new($size, $size)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    $outputGraphics.InterpolationMode = 'HighQualityBicubic'
    $outputGraphics.PixelOffsetMode = 'Half'
    $resampling = [System.Drawing.Imaging.ImageAttributes]::new()
    $resampling.SetWrapMode('TileFlipXY')
    $destination = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    $outputGraphics.DrawImage(
        $canvas, $destination, 0, 0, $supersampled, $supersampled, 'Pixel', $resampling
    )
    $output.Save((Join-Path $iconDirectory $name), [System.Drawing.Imaging.ImageFormat]::Png)

    $resampling.Dispose()
    $outputGraphics.Dispose()
    $output.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
    foreach ($brush in @($background, $leftFace, $rightFace, $topFace, $studWall, $studTop)) {
        $brush.Dispose()
    }
}

Draw-Icon 'icon-512.png' 512
Draw-Icon 'icon-192.png' 192
Draw-Icon 'apple-touch-icon.png' 180 -FullBleed
Draw-Icon 'favicon-32.png' 32
Draw-Icon 'icon-maskable-512.png' 512 -Maskable
