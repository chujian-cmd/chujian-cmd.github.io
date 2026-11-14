#!/bin/sh
cd "$(dirname "$0")"
(python3 -m http.server 8899 &)
sleep 1
xdg-open http://localhost:8899 2>/dev/null || open http://localhost:8899 2>/dev/null
echo "kami running at http://localhost:8899 - press Ctrl+C to stop"
wait
