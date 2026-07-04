# 8000 포트 종료
$pids = (netstat -aon | Select-String ":8000 ") -replace '.*\s+(\d+)$','$1'
foreach ($p in $pids) { try { Stop-Process -Id $p -Force } catch {} }

# 백엔드
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$PSScriptRoot\backend`" && venv\Scripts\uvicorn.exe main:app --reload --port 8000 --host 0.0.0.0" -WindowStyle Normal

Start-Sleep 3

# 프론트엔드
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$PSScriptRoot\frontend`" && npm run dev" -WindowStyle Normal

Start-Sleep 4

# 브라우저
Start-Process "http://localhost:5173"