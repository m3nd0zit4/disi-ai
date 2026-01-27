@echo off
echo ========================================
echo Starting DISI AI Workers
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: node_modules not found!
    echo Please run: npm install
    echo.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo ERROR: .env.local not found!
    echo Please create .env.local with required environment variables.
    echo See WORKER_SETUP.md for details.
    echo.
    pause
    exit /b 1
)

echo [1/3] Starting Next.js Dev Server...
start "DISI AI - Next.js" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo [2/3] Starting AI Worker...
start "DISI AI - AI Worker" cmd /k "npm run worker"
timeout /t 2 /nobreak >nul

echo [3/3] Starting File Worker...
start "DISI AI - File Worker" cmd /k "npm run file-worker"
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo All workers started successfully!
echo ========================================
echo.
echo Check the opened terminal windows for logs:
echo   - Next.js: http://localhost:3000
echo   - AI Worker: Processing canvas executions
echo   - File Worker: Processing Knowledge Garden uploads
echo.
echo Press any key to exit this launcher...
pause >nul
