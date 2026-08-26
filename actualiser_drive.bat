@echo off
chcp 65001 > nul
echo =========================================================
echo  Grimoire - Actualisation du Catalogue Google Drive
echo =========================================================
echo.
echo Scan et indexation du Google Drive en cours (sans telecharger les images)...
python "%~dp0scripts\generate_drive_catalog.py"
echo.
echo Catalogue a jour ! Vous pouvez lancer Grimoire.
echo.
pause
