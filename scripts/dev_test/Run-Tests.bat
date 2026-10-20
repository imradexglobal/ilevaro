@echo off
setlocal EnableDelayedExpansion
title Run Tests - ILEVARO
echo ==========================================
echo  ILEVARO - RUN ALL TESTS
echo ==========================================
echo.

:: Project root = two levels up from scripts\dev_test
cd /d "%~dp0..\.."
if not exist "package.json" (
    echo [ERROR] Could not find project root.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)

echo [1/3] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)

echo [2/3] Checking dependencies...
if not exist "node_modules\.bin\vitest.cmd" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        echo Window stays open so you can copy. Press Enter when done...
        set /p DONE=Press Enter to close...
        exit /b 1
    )
)

echo [3/3] Running tests...
echo ------------------------------------------
call npm test -- --run
if errorlevel 1 (
    echo.
    echo [ERROR] Tests failed. Fix errors and re-run.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)

echo.
echo ==========================================
echo  SUCCESS! All tests passed.
echo ==========================================
echo Window stays open so you can copy. Press Enter when done...
set /p DONE=Press Enter to close...
