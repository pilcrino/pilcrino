#!/bin/sh
# usage: build-gif.sh page frames out.gif [WxH]
# Renders <frames> frames of src/<page>.html at ten a second, then assembles a looping gif at the page's own size.
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
F=$(mktemp -d)
i=0
while [ $i -lt "$2" ]; do
 t=$(python3 -c "print($i/10)")
 "$SRC/render.sh" "$1" "$t" "$F/f$(printf %03d $i).png" 1 "${4:-1600,620}"
 i=$((i+1))
done
ffmpeg -loglevel error -y -framerate 10 -i "$F/f%03d.png" -vf "split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=none" -loop 0 "$3"
rm -r "$F"
ls -la "$3"; ffprobe -v error -show_entries stream=width,height,nb_frames "$3"
