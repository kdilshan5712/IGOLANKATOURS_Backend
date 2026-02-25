@echo off
echo ========================================
echo   Database Connection Fix Applied
echo ========================================
echo.
echo Restarting backend server with new settings...
echo.
echo Changes made:
echo   - Connection timeout: 30s -^> 60s
echo   - Retry attempts: 2 -^> 3
echo   - Retry delays: Progressive (5s, 10s, 15s)
echo   - Better error detection
echo.
echo ========================================
echo.
echo Please restart your backend server:
echo   1. Stop the current server (Ctrl+C)
echo   2. Run: node server.js
echo.
echo Then run: node fix-admin-login.js
echo.
pause
