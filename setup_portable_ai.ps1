# Script de configuration automatique de l'IA Portable pour Grimoire VTT (Windows)
# Faites un clic droit et choisissez "Exécuter avec PowerShell"

$BinDir = Join-Path $PSScriptRoot "src-tauri\bin"
if (!(Test-Path $BinDir)) { New-Item -ItemType Directory -Path $BinDir }

Write-Host "🚀 Préparation de l'IA Portable Grimoire pour Windows..." -ForegroundColor Cyan

$Url = "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip"
$ZipFile = Join-Path $PSScriptRoot "ollama_win.zip"

Write-Host "📥 Téléchargement de Ollama..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $Url -OutFile $ZipFile

Write-Host "📦 Extraction..." -ForegroundColor Yellow
Expand-Archive -Path $ZipFile -DestinationPath $BinDir -Force

# On déplace ollama.exe à la racine de bin si nécessaire
$ExePath = Join-Path $BinDir "ollama.exe"
if (Test-Path $ExePath) {
    Write-Host "✅ Ollama Windows est prêt dans $BinDir" -ForegroundColor Green
    
    Write-Host "🧠 Téléchargement du modèle IA (Llama3)... Cela peut prendre quelques minutes." -ForegroundColor Cyan
    $ModelsDir = Join-Path $BinDir "models"
    $ConfigDir = Join-Path $PSScriptRoot "src-tauri\config"
    
    # Lancement temporaire pour le pull
    $env:OLLAMA_MODELS = $ModelsDir
    $env:USERPROFILE = $ConfigDir
    $Process = Start-Process -FilePath $ExePath -ArgumentList "serve" -NoNewWindow -PassThru
    Start-Sleep -Seconds 8
    
    # Exécution du pull
    & $ExePath pull llama3
    
    # Arrêt du processus temporaire
    Stop-Process -Id $Process.Id
    Write-Host "✅ Modèle Llama3 téléchargé !" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur lors de l'extraction." -ForegroundColor Red
}

Remove-Item $ZipFile -ErrorAction SilentlyContinue

Write-Host "---"
Write-Host "✨ Terminé ! Grimoire est prêt à utiliser l'IA portable." -ForegroundColor Cyan
Pause
