param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Configuration Ultime & Optimisee IA Locale" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verification de Ollama et Optimisation
Write-Host "[1/5] Verification de Ollama et Optimisation..." -ForegroundColor Yellow
if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama n'est pas installe. Installation en cours via winget..." -ForegroundColor Magenta
    winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Variables d'optimisation Ollama : persistantes (User) ET session courante,
# sinon le serveur demarre ci-dessous sans en profiter.
$ollamaEnv = @{
    "OLLAMA_FLASH_ATTENTION" = "1"       # kernels d'attention optimises
    "OLLAMA_KV_CACHE_TYPE"   = "q8_0"    # cache KV quantifie (necessite flash attention)
    "OLLAMA_KEEP_ALIVE"      = "-1"      # garde le modele charge en permanence
    "OLLAMA_CONTEXT_LENGTH"  = "65536"   # Claude Code exige au moins 64K de contexte
}
foreach ($kv in $ollamaEnv.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "User")
    Set-Item -Path "Env:$($kv.Key)" -Value $kv.Value
}
Write-Host "Ollama optimise ! (Flash Attention, KV cache q8_0, Keep Alive permanent, contexte 64K) [OK]" -ForegroundColor Green

# Le serveur repond-il deja ? (plus fiable qu'un test de nom de processus)
$ollamaRunning = $false
try {
    $null = Invoke-RestMethod -Uri "http://localhost:11434/api/version" -TimeoutSec 2
    $ollamaRunning = $true
} catch {}

if (!$ollamaRunning) {
    Write-Host "Demarrage de Ollama en arriere-plan..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "Serveur Ollama deja actif. NOTE: redemarrez Ollama pour que les optimisations s'appliquent." -ForegroundColor Yellow
}

# 2. Selection du modele
Write-Host "`n[2/5] Selection du modele local..." -ForegroundColor Yellow
Write-Host "--- Gemma 4 (Google) ---"
Write-Host "1) Gemma 4 Edge (e4b)    - Pour PC classique"
Write-Host "2) Gemma 4 (12B)         - Pour tres bon PC (~7.6 Go)"
Write-Host "3) Gemma 4 (27B)         - Pour PC tres puissant (~17 Go, >= 24 Go VRAM)"
Write-Host "--- Recommandes par Ollama pour Claude Code (meilleur tool-use) ---"
Write-Host "4) Qwen 3.5 (9B)         - Bon compromis (~6.6 Go, contexte 256K)"
Write-Host "5) Qwen 3.5 (27B)        - Pour PC tres puissant (~17 Go, contexte 256K)"
Write-Host "6) GLM 4.7 Flash (30B)   - Pour PC tres puissant (~19 Go, contexte 198K)"
Write-Host "--- Cloud Ollama (GRATUIT avec compte Ollama, rien a telecharger) ---"
Write-Host "7) Qwen 3.5 Cloud        - Puissant, multimodal"
Write-Host "8) GLM 5 Cloud           - Tres puissant, excellent en code"
Write-Host "9) Kimi K2.5 Cloud       - Tres puissant, excellent en agentique"
$choix = Read-Host "Entrez le numero de votre choix (1 a 9)"

$model = ""
switch ($choix) {
    "1" { $model = "gemma4:e4b" }
    "2" { $model = "gemma4:12b" }
    "3" { $model = "gemma4:27b" }
    "4" { $model = "qwen3.5:9b" }
    "5" { $model = "qwen3.5:27b" }
    "6" { $model = "glm-4.7-flash" }
    "7" { $model = "qwen3.5:cloud" }
    "8" { $model = "glm-5:cloud" }
    "9" { $model = "kimi-k2.5:cloud" }
    default { $model = "gemma4:e4b" }
}

# Les modeles cloud necessitent un compte Ollama (gratuit)
if ($model -like "*:cloud") {
    Write-Host "`nLe modele $model tourne sur le cloud Ollama (gratuit, avec limites d'usage)." -ForegroundColor Cyan
    Write-Host "Connexion au compte Ollama requise (une page web va s'ouvrir si necessaire)..." -ForegroundColor Yellow
    ollama signin
}

Write-Host "Telechargement/Verification du modele $model..." -ForegroundColor Yellow
ollama pull $model

# 3. Installation Native de Claude Windows
Write-Host "`n[3/5] Installation de l'application Claude Native Windows..." -ForegroundColor Yellow
Write-Host "Tentative d'installation de l'App Claude Officielle..." -ForegroundColor Magenta
Write-Host "(NOTE: l'app de bureau Claude utilisera toujours les modeles Anthropic - seul Claude Code passera par Ollama)" -ForegroundColor DarkGray
winget install Anthropic.Claude --accept-source-agreements --accept-package-agreements -h

if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "NodeJS n'est pas installe, installation requise pour Claude Code..." -ForegroundColor Magenta
    winget install OpenJS.NodeJS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# 4. Installation et Optimisation de Claude Code
Write-Host "`n[4/5] Verification de Claude Code (CLI/Native)..." -ForegroundColor Yellow
if (!(Get-Command claude -ErrorAction SilentlyContinue)) {
    npm install -g @anthropic-ai/claude-code
    # Rafraichir le PATH pour que 'claude' soit trouvable dans cette session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
# Installation du build natif Windows pour Claude Code si disponible
if (Get-Command claude -ErrorAction SilentlyContinue) {
    claude install stable
} else {
    Write-Host "ATTENTION: 'claude' introuvable apres installation. Relancez le script dans un nouveau terminal." -ForegroundColor Red
}

# Nettoyage des variables globales conflictuelles (anciennes executions / autres outils).
# On ne definit PAS ANTHROPIC_BASE_URL/AUTH_TOKEN au niveau User : cela impacterait
# tous les outils utilisant le SDK Anthropic. Tout passe par settings.json ci-dessous.
foreach ($name in "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN") {
    [Environment]::SetEnvironmentVariable($name, $null, "User")
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
}

# Configuration du PATH pour Claude natif
$nativePath = "$env:USERPROFILE\.local\bin"
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$nativePath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$nativePath", "User")
}

# 5. Configuration de l'interface Claude (Fichier settings.json)
Write-Host "`n[5/5] Configuration de Claude Code (settings.json)..." -ForegroundColor Yellow
Write-Host "ATTENTION: ceci redirige TOUTES vos sessions Claude Code vers Ollama ($model)," -ForegroundColor Red
Write-Host "y compris celles utilisant votre compte Anthropic habituel." -ForegroundColor Red
$confirm = Read-Host "Continuer ? (O/N)"
if ($confirm -match '^[OoYy]') {
    $claudeDir = Join-Path $env:USERPROFILE ".claude"
    if (!(Test-Path $claudeDir)) {
        New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
    }

    $settingsFile = Join-Path $claudeDir "settings.json"

    # Sauvegarde de l'existant avant ecrasement
    if (Test-Path $settingsFile) {
        $backup = "$settingsFile.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $settingsFile $backup
        Write-Host "Ancien settings.json sauvegarde -> $backup" -ForegroundColor DarkGray
    }

    $settingsJson = @"
{
  "env": {
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "ANTHROPIC_AUTH_TOKEN": "ollama",
    "ANTHROPIC_BASE_URL": "http://localhost:11434"
  },
  "model": "$model"
}
"@

    $settingsJson | Set-Content $settingsFile -Encoding UTF8
    Write-Host "Configuration terminee avec succes ! [OK]" -ForegroundColor Green
} else {
    Write-Host "Configuration globale ignoree. Pour utiliser Ollama ponctuellement :" -ForegroundColor Yellow
    Write-Host "  ollama launch claude --model $model" -ForegroundColor Yellow
}

# Fin
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " Systeme Complet & Optimise Installe !" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. Fermez tous vos terminaux (VS Code / PowerShell)."
Write-Host "2. Relancez VS Code."
Write-Host "3. Lancez 'claude' (ou 'ollama launch claude') pour demarrer avec $model !" -ForegroundColor Yellow
Write-Host "   Astuce perf : 'claude --bare' desactive les en-tetes qui invalident le cache KV." -ForegroundColor DarkGray
