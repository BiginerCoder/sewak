@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Starting Sewak from:
echo %ROOT%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is required. Install Node.js 20.9 or newer, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm enabled, then run this file again.
  pause
  exit /b 1
)

if not exist "d-f\node_modules\next\dist\bin\next" (
  echo ERROR: Frontend dependencies are missing.
  echo Run: npm --prefix d-f install
  pause
  exit /b 1
)

if not exist "d-f\.env" (
  echo ERROR: d-f\.env is missing. Copy d-f\.env.example to d-f\.env and configure it first.
  pause
  exit /b 1
)

set "WEB_PORT=3000"
set "WEB_URL=http://127.0.0.1:%WEB_PORT%"
netstat -ano -p tcp | findstr /R /C:":3000 .*LISTENING" >nul
if errorlevel 1 goto start_website

curl.exe --max-time 4 --silent --output NUL --fail "%WEB_URL%/login"
if not errorlevel 1 goto website_ready

echo Port 3000 is occupied by a server that is not responding as Sewak.
set "WEB_PORT=3001"
set "WEB_URL=http://127.0.0.1:%WEB_PORT%"
netstat -ano -p tcp | findstr /R /C:":3001 .*LISTENING" >nul
if errorlevel 1 goto start_website

curl.exe --max-time 4 --silent --output NUL --fail "%WEB_URL%/login"
if not errorlevel 1 goto website_ready

echo ERROR: Ports 3000 and 3001 are occupied, and neither responds as Sewak.
echo Close the unrelated or unresponsive service and run this file again.
pause
exit /b 1

:start_website
echo Starting the Sewak website on %WEB_URL% ...
start "Sewak Website" /D "%ROOT%d-f" cmd /k "npm run dev -- --hostname 127.0.0.1 --port %WEB_PORT%"

:website_ready
echo The Sewak website is available at %WEB_URL%.

if exist "govlinks\.env" if exist "govlinks\.venv\Scripts\python.exe" (
  netstat -ano -p tcp | findstr /R /C:":8080 .*LISTENING" >nul
  if errorlevel 1 (
    echo Starting the Govlinks API on http://127.0.0.1:8080 ...
    start "Govlinks API" /D "%ROOT%govlinks" cmd /k "set GOVLINKS_HOST=127.0.0.1&&set GOVLINKS_ALLOW_DEMO=1&&set PORT=8080&&.venv\Scripts\python.exe api.py"
  ) else (
    echo A service is already listening on port 8080; reusing it.
  )
) else (
  echo Govlinks was not started because govlinks\.env or its Python virtual environment is missing.
  echo See the setup instructions in README.md if you need the government-links API.
)

echo.
echo Opening the website in your browser...
start "" "%WEB_URL%"
echo.
echo Keep the Sewak Website and Govlinks API windows open while you use the site.
echo Close those windows to stop their development servers.
echo This launcher does not create databases, run migrations, or start PostgreSQL.
echo.
endlocal
exit /b 0
