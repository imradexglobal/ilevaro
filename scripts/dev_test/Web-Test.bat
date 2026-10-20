@echo off
setlocal EnableDelayedExpansion
title Web Test - ILEVARO
echo ==========================================
echo  ILEVARO - Web TEST (clean rebuild + dev^)
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

echo [1/4] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)

echo [2/4] Checking dependencies...
if not exist "node_modules\.bin\vite.cmd" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        echo Window stays open so you can copy. Press Enter when done...
        set /p DONE=Press Enter to close...
        exit /b 1
    )
)

echo [3/4] Cleaning stale output (full rebuild, no leftovers)...
if exist "dist" rmdir /s /q "dist"
if exist "dist" (
    echo [ERROR] Could not delete dist\ - close anything locking it, then retry.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)
echo [OK] dist\ cleared.
:: Remove stale TypeScript incremental cache - a killed build can leave it
:: corrupt and make tsc -b hang indefinitely on the next run.
if exist "node_modules\.tmp" rmdir /s /q "node_modules\.tmp"
echo [OK] TS incremental cache cleared.

echo [4/4] Stamping build time + rebuilding web app from current source...
echo ------------------------------------------
call node scripts/stamp-build.mjs
if errorlevel 1 (
    echo [ERROR] Build stamp failed.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo [ERROR] Web build failed. Fix errors and re-run.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)
if not exist "dist\index.html" (
    echo [ERROR] Build produced no dist\index.html.
    echo Window stays open so you can copy. Press Enter when done...
    set /p DONE=Press Enter to close...
    exit /b 1
)
echo [OK] dist/ freshly rebuilt - no stale code.
echo.
echo Starting dev server at http://localhost:5173 ...
echo Press Ctrl+C to stop.
:: Wait for the port to actually answer before opening the browser.
start /b cmd /c "powershell -NoProfile -ExecutionPolicy Bypass -Command ""$d=(Get-Date).AddSeconds(90); while((Get-Date) -lt $d){ try { if((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:5173/).StatusCode -eq 200){ exit 0 } } catch {}; Start-Sleep -Milliseconds 250 }; exit 1"" && start http://localhost:5173"
call npm run dev
echo Window stays open so you can copy. Press Enter when done...
set /p DONE=Press Enter to close...
