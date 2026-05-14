#!/bin/bash

# Script de configuration automatique de l'IA Portable pour Grimoire VTT
# Ce script télécharge Ollama et le prépare pour une utilisation sans installation.

set -e

echo "🚀 Préparation de l'IA Portable Grimoire..."

# Détection de l'OS
OS="linux"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi

# Dossier cible (on le met dans src-tauri/bin pour le développement)
BIN_DIR="src-tauri/bin"
mkdir -p "$BIN_DIR"

echo "📂 Dossier cible : $BIN_DIR"

if [ "$OS" == "linux" ]; then
    echo "📥 Téléchargement de Ollama pour Linux..."
    curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst -o ollama_linux.tar.zst
    
    echo "📦 Extraction..."
    # On extrait juste le binaire ollama dans le dossier bin
    # Note: tar.zst nécessite zstd installé sur la machine
    if command -v zstd >/dev/null 2>&1; then
        tar --use-compress-program=unzstd -xvf ollama_linux.tar.zst --strip-components=1 bin/ollama
        mv bin/ollama "$BIN_DIR/ollama"
        rmdir bin 2>/dev/null || true
    else
        echo "⚠️ Erreur : 'zstd' n'est pas installé sur votre système."
        echo "Veuillez l'installer (ex: sudo apt install zstd) ou télécharger manuellement le binaire."
        exit 1
    fi
    
    chmod +x "$BIN_DIR/ollama"
    rm ollama_linux.tar.zst
    echo "✅ Ollama Linux est prêt !"

    echo "🧠 Téléchargement du modèle IA (Llama3)..."
    # Lancement temporaire pour le pull
    OLLAMA_MODELS="$BIN_DIR/models" HOME="src-tauri/config" "$BIN_DIR/ollama" serve &
    OLLAMA_PID=$!
    sleep 5
    OLLAMA_MODELS="$BIN_DIR/models" HOME="src-tauri/config" "$BIN_DIR/ollama" pull llama3
    kill $OLLAMA_PID
    echo "✅ Modèle Llama3 téléchargé !"

else
    echo "📥 Téléchargement de Ollama pour Windows..."
    curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip -o ollama_win.zip
    
    echo "📦 Extraction (nécessite unzip)..."
    unzip -o ollama_win.zip ollama.exe -d "$BIN_DIR"
    rm ollama_win.zip
    
    # PowerShell part for model pull
    powershell -Command "
    \$BinDir = 'src-tauri/bin'
    \$ExePath = Join-Path \$BinDir 'ollama.exe'
    if (Test-Path \$ExePath) {
        Write-Host '✅ Ollama Windows est prêt dans \$BinDir' -ForegroundColor Green
        
        Write-Host '🧠 Téléchargement du modèle IA (Llama3)... Cela peut prendre quelques minutes.' -ForegroundColor Cyan
        \$ModelsDir = Join-Path \$BinDir 'models'
        \$ConfigDir = Join-Path \$PSScriptRoot 'src-tauri\config'
        
        # Lancement temporaire
        \$env:OLLAMA_MODELS = \$ModelsDir
        \$env:USERPROFILE = \$ConfigDir
        \$Process = Start-Process -FilePath \$ExePath -ArgumentList 'serve' -NoNewWindow -PassThru
        Start-Sleep -Seconds 8
        
        & \$ExePath pull llama3
        
        Stop-Process -Id \$Process.Id
        Write-Host '✅ Modèle Llama3 téléchargé !' -ForegroundColor Green
    }"
fi

echo "---"
echo "✨ Configuration terminée !"
echo "Grimoire utilisera maintenant automatiquement l'IA située dans : $BIN_DIR"
echo "Les modèles seront stockés localement dans $BIN_DIR/models"
