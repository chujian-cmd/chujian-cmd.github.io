#!/bin/sh
# 在本目录起本地服务器，然后浏览器打开 http://localhost:8000/
cd "$(dirname "$0")" && python3 -m http.server 8000
