@echo off
rem Serve this folder locally, then open http://localhost:8000/ in a browser.
cd /d %~dp0
python -m http.server 8000
pause
