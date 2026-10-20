@echo off
setlocal EnableDelayedExpansion
title Deploy Firestore Rules - ILEVARO
echo ==========================================
echo  ILEVARO - Deploy Firestore Rules + Indexes
echo  Usage: Deploy-Rules.bat [rules^|indexes^|all]
echo         No arg = rules + indexes.
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

:: Default: deploy both rules and indexes
set TARGET=firestore
if /I "%~1"=="rules" set TARGET=firestore:rules
if /I "%~1"=="indexes" set TARGET=firestore:indexes

echo [1/3] Checking firebase-tools...
if not exist "node_modules\.bin\firebase.cmd" (
    echo [INFO] firebase-tools not found - installing...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        echo Window stays open so you can copy. Press Enter when done...
        set /p DONE=Press Enter to close...
        exit /b 1
    )
)

echo [2/3] Deploying %TARGET% to project ilevaro...
echo ------------------------------------------
call npx --no-install firebase deploy --only %TARGET% --project ilevaro --non-interactive
if errorlevel 1 (
    echo.
    echo [ERROR] Deploy failed. Check you are logged in: npx firebase login
    echo and that project "ilevaro" exists.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)

echo.
echo [3/3] Verifying...
echo ==========================================
echo  SUCCESS! %TARGET% deployed to project ilevaro.
echo ==========================================
echo Window stays open so you can copy. Press Enter when done...
set /p DONE=Press Enter to close...
