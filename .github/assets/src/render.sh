#!/bin/sh
# usage: render.sh page t out.png [scale] [WxH]
# Headless Chrome now and then hangs on a frame: kill that one process after 30 s and try again.
B=$(cd "$(dirname "$0")" && pwd)
for try in 1 2 3; do
 rm -f "$3"
 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=${4:-2} --window-size=${5:-1600,620} --virtual-time-budget=5000 --screenshot="$3" "file://$B/$1.html?t=$2" 2>/dev/null &
 pid=$!
 n=0; while kill -0 $pid 2>/dev/null && [ $n -lt 300 ]; do sleep 0.1; n=$((n+1)); done
 if kill -0 $pid 2>/dev/null; then kill -9 $pid; wait $pid 2>/dev/null; else wait $pid; fi
 [ -s "$3" ] && exit 0
done
echo "render failed: $1 t=$2" >&2; exit 1
