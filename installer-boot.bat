@echo off
echo Installation demarrage automatique...
set "SRC=%~dp0demarrer-24-7.bat"
set "DST=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DiscordAlwaysScreen.bat"
copy /Y "%SRC%" "%DST%" >nul
echo ✅ Ajoute au demarrage Windows: %DST%
echo Creation tache planifiee (redemarre meme si tu fermes)...
schtasks /create /tn "DiscordAlwaysScreen" /tr "\"%SRC%\"" /sc onlogon /rl highest /f >nul 2>&1
if %errorlevel%==0 echo ✅ Tache planifiee creee
echo.
echo Lance maintenant...
start "" "%SRC%"
echo Termine ! Ton Discord reste en partage d'ecran meme apres redemarrage.
pause
