@echo off
chcp 65001 >nul
rem DAILY: Aenderungen zu GitHub hochladen (Vercel veroeffentlicht danach automatisch).
rem Liegt eine Datei .commit-msg.txt von Claude vor, wird deren Kommentar uebernommen.
cd /d "%~dp0"

git add .
git diff --cached --quiet
if %errorlevel%==0 (
  echo Keine Aenderungen - nichts hochzuladen.
  goto ende
)

if not exist ".commit-msg.txt" goto eigener
echo Commit-Kommentar von Claude:
echo ------------------------------------------------------------
type ".commit-msg.txt"
echo.
echo ------------------------------------------------------------
set "MSG="
set /p "MSG=Enter = uebernehmen, oder eigenen Kommentar eingeben: "
if not "%MSG%"=="" goto commit_eigen
git commit -F ".commit-msg.txt"
if errorlevel 1 goto fehler
del ".commit-msg.txt"
goto push

:eigener
set "MSG="
set /p "MSG=Kurze Beschreibung der Aenderung (Enter = Update): "
if "%MSG%"=="" set "MSG=Update"

:commit_eigen
git commit -m "%MSG%"
if errorlevel 1 goto fehler
if exist ".commit-msg.txt" del ".commit-msg.txt"

:push
git push
if errorlevel 1 goto fehler
echo.
echo Fertig. In ca. 1 Minute ist die neue Version auf Vercel online.
goto ende

:fehler
echo.
echo FEHLER. Bitte die Meldung oben an Claude schicken.

:ende
echo.
pause
