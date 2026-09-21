@echo off
title Discord Always Screen 24/7
cd /d "%~dp0"
:loop
echo [%date% %time%] Lancement...
node index.js
echo [%date% %time%] Crash ou arret, redemarrage dans 5s...
timeout /t 5 >nul
goto loop
