@echo off
chcp 65001 >nul
rem DAILY: Aenderungen zu GitHub hochladen (Vercel veroeffentlicht danach automatisch).
rem Liegt eine Datei .commit-msg.txt von Claude vor, wird deren Kommentar uebernommen.
cd /d "%~dp0"

rem Zuerst den aktuellen Stand von GitHub holen (Claude kann direkt dorthin hochladen)
echo Hole den aktuellen Stand von GitHub ...
git pull --rebase --autostash
if errorlevel 1 goto fehler
echo.

git add .
git diff --cached --quiet
if %errorlevel%==0 goto keine

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

:keine
rem Nichts Neues - aber vielleicht liegen noch Commits, deren Hochladen fehlgeschlagen ist
set "AHEAD=0"
for /f %%n in ('git rev-list --count "@{u}..HEAD"') do set "AHEAD=%%n"
if not "%AHEAD%"=="0" goto nachholen
echo Keine Aenderungen - nichts hochzuladen.
goto ende

:nachholen
echo Keine neuen Aenderungen, aber %AHEAD% Commit - noch nicht hochgeladen. Lade hoch ...
goto push

:fehler
echo.
echo FEHLER. Bitte die Meldung oben an Claude schicken.

:ende
echo.
pause
