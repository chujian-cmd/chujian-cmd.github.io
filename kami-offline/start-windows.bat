@echo off
cd /d %~dp0
start http://localhost:8899
python -m http.server 8899
pause
