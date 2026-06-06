$urls = @(
  "https://cdn2.inkarnate.com/2hopvd3mdrzcyakojk6wsextckwl",
  "https://cdn2.inkarnate.com/5e39zb5745yhzty0rkff5v68sbpc",
  "https://cdn2.inkarnate.com/c3a9pw8fv6u7mmeezc6dc0ityndx",
  "https://cdn2.inkarnate.com/tfff6sjh7g1wud7g8hvtrokbjd4u",
  "https://cdn2.inkarnate.com/thbv57454mx0x0z5pvclvwka0dvq",
  "https://cdn2.inkarnate.com/l288xlj7ey6cqfv4wndrwa6ma8y4"
)

$destDir = "d:\DEV\grimoire\map-editor\public\assets\stamps"
if (-not (Test-Path $destDir)) {
  New-Item -ItemType Directory -Path $destDir -Force
}

for ($i = 0; $i -lt $urls.Length; $i++) {
  $idx = $i + 1
  $url = $urls[$i]
  $destFile = Join-Path $destDir "tree_variant_$idx.png"
  Write-Host "Downloading $url to $destFile..."
  Invoke-WebRequest -Uri $url -OutFile $destFile
}
Write-Host "Done!"
