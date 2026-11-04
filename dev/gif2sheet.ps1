# 개발용: GIF → 투명 배경 스프라이트 시트 PNG (가로로 한 줄). 게임에는 안 들어감
# 쓰는 법: powershell -File dev\gif2sheet.ps1 <입력.gif> <출력.png> [한 칸 크기(px), 기본 160]
#  - 바깥 흰 배경만 지운다 (테두리 안쪽의 흰 몸은 그대로). 캐릭터 둘레를 모든 프레임에 같은 크기로 잘라 맞춘다
param([string]$In, [string]$Out, [int]$Cell = 160)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path $In))
$dim = New-Object System.Drawing.Imaging.FrameDimension($img.FrameDimensionsList[0])
$n = $img.GetFrameCount($dim)
$W = $img.Width; $H = $img.Height
$frames = @()
$minx = $W; $miny = $H; $maxx = -1; $maxy = -1
for ($i = 0; $i -lt $n; $i++) {
  $img.SelectActiveFrame($dim, $i) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White); $g.DrawImage($img, 0, 0, $W, $H); $g.Dispose()
  # 가장자리에서 흰색(밝은 색)만 번져 가며 투명으로
  $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $H)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $seen = New-Object bool[] ($W * $H)
  $stack = New-Object System.Collections.Generic.Stack[int]
  $isBg = { param($p) $o = $p * 4; ($bytes[$o] -ge 232) -and ($bytes[$o + 1] -ge 232) -and ($bytes[$o + 2] -ge 232) }
  for ($x = 0; $x -lt $W; $x++) { $stack.Push($x); $stack.Push(($H - 1) * $W + $x) }
  for ($y = 0; $y -lt $H; $y++) { $stack.Push($y * $W); $stack.Push($y * $W + $W - 1) }
  while ($stack.Count -gt 0) {
    $p = $stack.Pop()
    if ($seen[$p]) { continue }
    $seen[$p] = $true
    if (-not (& $isBg $p)) { continue }
    $bytes[$p * 4 + 3] = 0
    $x = $p % $W; $y = [math]::Floor($p / $W)
    if ($x -gt 0) { $stack.Push($p - 1) }; if ($x -lt $W - 1) { $stack.Push($p + 1) }
    if ($y -gt 0) { $stack.Push($p - $W) }; if ($y -lt $H - 1) { $stack.Push($p + $W) }
  }
  # 경계 상자 (모든 프레임 공통)
  for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) { if ($bytes[($y * $W + $x) * 4 + 3] -gt 0) { if ($x -lt $minx) { $minx = $x }; if ($x -gt $maxx) { $maxx = $x }; if ($y -lt $miny) { $miny = $y }; if ($y -gt $maxy) { $maxy = $y } } } }
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
  $bmp.UnlockBits($data)
  $frames += $bmp
}
$bw = $maxx - $minx + 1; $bh = $maxy - $miny + 1
$side = [math]::Max($bw, $bh)
$scale = $Cell / $side
$sheet = New-Object System.Drawing.Bitmap(($Cell * $n), $Cell, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
for ($i = 0; $i -lt $n; $i++) {
  # 발이 칸 바닥에, 가로는 가운데
  $dw = $bw * $scale; $dh = $bh * $scale
  $dx = $i * $Cell + ($Cell - $dw) / 2; $dy = $Cell - $dh
  $src = New-Object System.Drawing.RectangleF($minx, $miny, $bw, $bh)
  $dst = New-Object System.Drawing.RectangleF($dx, $dy, $dw, $dh)
  $g.DrawImage($frames[$i], $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}
$g.Dispose()
New-Item -ItemType Directory -Force (Split-Path (Join-Path (Get-Location) $Out)) | Out-Null
$sheet.Save((Join-Path (Get-Location) $Out), [System.Drawing.Imaging.ImageFormat]::Png)
"$Out : $n frames, cell $Cell, source box ${bw}x${bh} at ($minx,$miny)"
