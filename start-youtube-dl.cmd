@echo off
chcp 65001 >nul
title Grimoire - Telechargeur YouTube
cd /d "%~dp0"

echo ===============================================================================
echo   🎬  GRIMOIRE - Telechargeur YouTube (interface locale)
echo ===============================================================================
echo.
echo   Règle des cookies YouTube :
echo     - L'interface s'ouvre dans un navigateur AU CHOIX (elle n'a besoin
echo       d'aucun compte, aucun cookie) - par defaut le navigateur principal.
echo     - Si vous utilisez "cookies du navigateur", SEUL ce navigateur-la
echo       doit etre ferme au lancement du telechargement.
echo     - Alternative sans rien fermer : un fichier cookies.txt (extension
echo       "Get cookies.txt"), chemin a coller dans l'interface.
echo     - Astuce : lancez ce fichier avec l'argument "edge" pour ouvrir
echo       l'interface dans Edge et garder Chrome libre pour ses cookies :
echo         start-youtube-dl.cmd edge
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Node.js introuvable dans le PATH.
    pause
    exit /b 1
)

if not exist "%LOCALAPPDATA%\grimoire-tools\yt-dlp.exe" (
    echo [AVERTISSEMENT] yt-dlp.exe introuvable dans %LOCALAPPDATA%\grimoire-tools
    echo                 L'interface s'ouvrira quand meme, mais le telechargement echouera.
    echo.
)

if /i "%~1"=="edge" (
    start "" msedge "http://localhost:5199"
) else (
    start "" "http://localhost:5199"
)
node tools\yt-dl-gui\server.mjs
pause
