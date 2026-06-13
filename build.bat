@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title The SMC Trading App - Build

echo.
echo ============================================
echo   The SMC Trading App - Beta Build
echo ============================================
echo.

set PY=
if defined PYTHON (
    if exist "%PYTHON%" set PY=%PYTHON%
)
if not defined PY (
    for %%P in (
        "%LOCALAPPDATA%\Python\bin\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "C:\Python314\python.exe"
        "C:\Python313\python.exe"
        "C:\Python312\python.exe"
        "C:\Python311\python.exe"
    ) do (
        if exist %%P set PY=%%P
    )
)
if not defined PY (
    for /f "delims=" %%i in ('where python 2^>nul') do (
        if not defined PY set PY=%%i
    )
)
if not defined PY (
    echo [ERROR] Python not found.
    echo Set the PYTHON environment variable to your python.exe path.
    pause
    exit /b 1
)

echo [0] Python: %PY%
%PY% --version
echo.

echo [1/3] Building Python backend...
cd backend
%PY% -m pip install --quiet --upgrade pyinstaller
%PY% -m PyInstaller backend.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] PyInstaller failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo   Done -^> backend\dist\smc-bot-backend\
echo.

echo [2/3] Building React frontend...
cd v2
if not exist "node_modules" (
    echo   Running npm install...
    npm.cmd install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        cd ..
        pause
        exit /b 1
    )
)
npm.cmd run build
if errorlevel 1 (
    echo [ERROR] Vite build failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo   Done -^> v2\dist\
echo.

echo [3/3] Packaging installer...
cd v2
npx.cmd electron-builder --win
if errorlevel 1 (
    echo [ERROR] electron-builder failed.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ============================================
echo   BUILD COMPLETE
echo   release\The SMC Trading App Setup 1.0.0-beta.1.exe
echo ============================================
echo.
pause
