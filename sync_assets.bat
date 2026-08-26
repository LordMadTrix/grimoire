@echo off
chcp 65001 > nul
setlocal

echo ===================================================
echo  Grimoire & Map Editor - Synchroniseur d'Assets
echo ===================================================
echo.

if "%~1"=="" (
    echo [1] Reconstruction des catalogues actuels...
    node "%~dp0sync_local_assets.js" --rebuild-only
) else (
    echo [1] Importation et synchronisation depuis : "%~1"
    node "%~dp0sync_local_assets.js" "%~1"
)

echo.
echo Termine !
pause
