@echo off
chcp 65001 >nul
title Banc d'essai du tutoriel - Baobabs

rem Ouvrir banc-essai.html par double-clic ne marche pas : le navigateur
rem interdit fetch() sur file://, et le tutoriel va chercher son fragment
rem par fetch. La page s'affiche quand meme -- le CSS, lui, passe -- ce qui
rem rend la panne incomprehensible. Ce lanceur monte un vrai serveur local
rem puis ouvre la bonne adresse.

cd /d "%~dp0.."

echo.
echo   Demarrage du serveur local sur le port 8899...
start "Serveur Baobabs (laisser ouvert)" cmd /c "python -m http.server 8899"

timeout /t 2 /nobreak >nul

echo   Ouverture du banc d'essai...
start "" http://localhost:8899/tutoriel/banc-essai.html

echo.
echo   C'est ouvert. Laissez la fenetre "Serveur Baobabs" ouverte
echo   tant que vous testez, et fermez-la quand vous avez fini.
echo.
timeout /t 4 /nobreak >nul
