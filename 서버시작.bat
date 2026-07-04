@echo off
echo [1/3] Killing port 8000...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 "') do taskkill /PID %%a /F >nul 2>&1

echo [2/3] Starting backend...
start "CSEP Backend" cmd /k "cd /d ""%~dp0backend"" && venv\Scripts\uvicorn.exe main:app --reload --port 8000 --host 0.0.0.0"

echo [3/3] Starting frontend...
timeout /t 3 /nobreak >nul
start "CSEP Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:5173
echo  API Docs : http://localhost:8000/docs
echo.
pause
