@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 Open_SOFR.py %*
) else (
    python Open_SOFR.py %*
)
if errorlevel 1 (
    echo.
    echo The model could not start. See the message above and README.md.
    pause
)
