$mapsDir = "d:\DEV\grimoire\public\maps"
$outputFile = "d:\DEV\grimoire\public\library.js"

$files = Get-ChildItem -Path $mapsDir -Filter *.jpg

$jsonArray = @()
foreach ($file in $files) {
    # Extract ID without extension
    $id = $file.BaseName
    
    $obj = [PSCustomObject]@{
        id = $id
        name = "Carte $id"
        path = "./maps/" + $file.Name
    }
    $jsonArray += $obj
}

$jsonStr = $jsonArray | ConvertTo-Json -Depth 2
$jsContent = "const GRIMOIRE_MAPS = $jsonStr;"

Set-Content -Path $outputFile -Value $jsContent -Encoding UTF8
Write-Host "Bibliothèque mise à jour avec $($files.Count) cartes !"
