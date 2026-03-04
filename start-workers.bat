@echo off
echo ========================================
echo Starting DISI AI
echo ========================================
echo.
echo AI and file processing now run via Inngest (no separate worker processes).
echo.

if not exist "node_modules\" (
    echo ERROR: node_modules not found! Run: npm install
    pause
    exit /b 1
)

if not exist ".env.local" (
    echo ERROR: .env.local not found!
    pause
    exit /b 1
)

echo Starting Next.js Dev Server...
start "DISI AI - Next.js" cmd /k "npm run dev"
echo.
echo Next.js: http://localhost:3000
echo Press any key to exit this launcher...
pause >nul
