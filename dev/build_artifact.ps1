# index.html -> claude.ai 아티팩트 페이지 (제목·스타일 링크 + body 안쪽만). 사용: powershell -File dev\build_artifact.ps1 <out.html>
param([string]$Out)
$html = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\index.html'), [Text.Encoding]::UTF8)
$title = [regex]::Match($html, '<title>.*?</title>', 'Singleline').Value
$link = [regex]::Match($html, '<link rel="stylesheet"[^>]*>').Value
$body = [regex]::Match($html, '<body>\s*(.*?)\s*</body>', 'Singleline').Groups[1].Value
$head = $title + "`n" + $link + "`n<style>`n  /* claude.ai 화면: 페이지 틀이 안전 영역 여백을 주므로 높이를 100%로 맞춘다 */`n  #app { height: 100%; }`n</style>`n"
[IO.File]::WriteAllText($Out, $head + $body + "`n", (New-Object Text.UTF8Encoding($false)))
"wrote $Out $(($head + $body).Length) chars"
