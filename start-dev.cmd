@echo off
chcp 65001 >nul
title Grimoire - Dev Mode
cd /d "%~dp0"
set "DEV_CMD=npm run tauri dev"

echo ===============================================================================
echo   🧙 GRIMOIRE - Démarrage de l'environnement de développement
echo ===============================================================================
echo.

:: 1. Vérification de Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    )
)

where node >nul 2>&1
if %ERRORLEVEL% equ 0 goto check_npm

echo [ERREUR] Node.js n'est pas installé ou n'est pas dans le PATH.
where winget >nul 2>&1
if %ERRORLEVEL% neq 0 goto manual_node

echo Outil winget détecté.
set /p INSTALL_NODE="Voulez-vous installer Node.js LTS automatiquement avec winget ? [O/N] : "
if /i "%INSTALL_NODE:~0,1%"=="O" (
    echo.
    echo Installation de Node.js LTS en cours...
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    echo.
    echo Installation terminée. Relancement de la vérification...
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
        goto check_npm
    )
    echo Veuillez fermer puis rouvrir cette console pour recharger le PATH.
    pause
    exit /b 0
)

:manual_node
echo Téléchargez et installez Node.js (v18+) depuis https://nodejs.org/
echo.
pause
exit /b 1

:check_npm
where npm >nul 2>&1
if %ERRORLEVEL% equ 0 goto check_rust

echo [ERREUR] npm n'a pas été trouvé dans le PATH.
pause
exit /b 1

:check_rust
:: Vérification si cargo est dans %USERPROFILE%\.cargo\bin
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

where cargo >nul 2>&1
if %ERRORLEVEL% equ 0 goto check_deps

echo ===============================================================================
echo [REQUIS POUR LE DESKTOP] Rust et Cargo ne sont pas installés.
echo Tauri a besoin de Rust pour compiler le backend desktop de Grimoire.
echo ===============================================================================
echo.

where winget >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Outil winget détecté.
    set /p INSTALL_RUST="Voulez-vous installer Rustup [Rust et Cargo] maintenant via winget ? [O/N] : "
    if /i "%INSTALL_RUST:~0,1%"=="O" (
        echo.
        echo Installation de Rustup en cours...
        winget install --id Rustlang.Rustup -e --accept-package-agreements --accept-source-agreements
        echo.
        if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
            set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
            goto check_deps
        )
        echo Installation lancée. Si nécessaire, fermez et relancez cette console pour actualiser le PATH.
        pause
        exit /b 0
    )
)

echo Vous pouvez installer Rust depuis https://rustup.rs/
echo.
pause
exit /b 1

:check_deps
:: 3. Vérification des dépendances Grimoire (node_modules)
set "NEED_INSTALL=0"
if not exist "node_modules\" set "NEED_INSTALL=1"
if not exist "node_modules\.bin\vite.cmd" (
    if not exist "node_modules\.package-lock.json" set "NEED_INSTALL=1"
)

if "%NEED_INSTALL%"=="1" (
    echo [1/2] Premier démarrage ou dépendances manquantes détectées.
    echo Installation des dépendances Grimoire [npm install]...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERREUR] L'installation des dépendances Grimoire a échoué.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dépendances Grimoire installées avec succès.
    echo.
) else (
    echo [OK] Dépendances Grimoire présentes.
)

:: 4. Vérification des dépendances Map Editor
if not exist "map-editor\node_modules\" (
    echo [2/2] Installation des dépendances du Map Editor...
    echo.
    call npm install --prefix map-editor
    if errorlevel 1 (
        echo.
        echo [ERREUR] L'installation des dépendances du Map Editor a échoué.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dépendances Map Editor installées avec succès.
    echo.
) else (
    echo [OK] Dépendances Map Editor présentes.
)

echo.
echo ===============================================================================
echo   Lancement de Grimoire en mode Desktop [Tauri dev]...
echo ===============================================================================
echo.

:: Fermeture des anciennes instances et libération des ports 5173 / 5174 si déjà occupés
taskkill /F /IM grimoire.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 :5174"') do (
    taskkill /F /PID %%a >nul 2>&1
)

call %DEV_CMD%
if errorlevel 1 (
    echo.
    echo [INFO] L'application s'est arrêtée avec le code %ERRORLEVEL%.
    pause
)

