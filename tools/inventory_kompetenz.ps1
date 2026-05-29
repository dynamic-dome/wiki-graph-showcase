# Inventory of the kompetenz-wiki core tier (competences/synthesis/topics).
# Writes a BOM-free, sorted list of vault-relative page IDs (no .md) to TEMP.
# See global rule 10.6 (run via -File, not inline) and 10.7 (UTF8Encoding($false)).
$root = 'C:\Users\domes\Desktop\kompetenz-wiki'
$dirs = 'wiki\competences', 'wiki\synthesis', 'wiki\topics'
$out = @()
foreach ($d in $dirs) {
  $full = Join-Path $root $d
  if (-not (Test-Path -LiteralPath $full)) { Write-Warning "missing dir: $full"; continue }
  Get-ChildItem -LiteralPath $full -Filter '*.md' -File |
    Where-Object { $_.Name -ne 'README.md' } |
    ForEach-Object {
      $rel = $_.FullName.Replace("$root\", '') -replace '\\', '/' -replace '\.md$', ''
      $out += $rel
    }
}
$sorted = $out | Sort-Object
$text = ($sorted -join "`n")
$dest = Join-Path $env:TEMP 'kompetenz-core.txt'
[IO.File]::WriteAllText($dest, $text, (New-Object System.Text.UTF8Encoding $false))
Write-Host "$($sorted.Count) core pages -> $dest"
$sorted | ForEach-Object { Write-Host "  $_" }
