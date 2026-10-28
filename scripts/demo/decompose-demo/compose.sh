#!/usr/bin/env bash
# Trim each scene's blank lead (record.js measured it), fade between scenes, and
# encode the docs' WebM and a poster frame.
#
#   DEMO_DIR=/abs/demo ./compose.sh      → $DEMO_DIR/decompose-demo.webm, poster.png
set -euo pipefail
: "${DEMO_DIR:?set DEMO_DIR to the directory record.js wrote scenes/ into}"
SCENES="$DEMO_DIR/scenes"
OUT="$DEMO_DIR/compose-$(date +%s)"
mkdir -p "$OUT/segs"
for f in "$SCENES"/*.webm; do
  n=$(basename "$f" .webm)
  lead=$(node -e "console.log(require('$SCENES/leads.json')['$n'] ?? 0.4)")
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  len=$(node -e "console.log(($dur - $lead).toFixed(2))")
  fade_out=$(node -e "console.log(($len - 0.35).toFixed(2))")
  ffmpeg -v error -y -ss "$lead" -i "$f" -t "$len" \
    -vf "fps=30,scale=1280:720:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=$fade_out:d=0.35" \
    -c:v libx264 -crf 24 -preset slow -an "$OUT/segs/$n.mp4"
  echo "file '$OUT/segs/$n.mp4'" >> "$OUT/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/joined.mp4"
ffmpeg -v error -y -i "$OUT/joined.mp4" -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -an "$DEMO_DIR/decompose-demo.webm"
# The workspace scene, with the plan drawn over a real screen.
ffmpeg -v error -y -ss 68 -i "$OUT/joined.mp4" -frames:v 1 "$DEMO_DIR/poster.png"
echo "  $DEMO_DIR/decompose-demo.webm ($(du -h "$DEMO_DIR/decompose-demo.webm" | cut -f1)), poster.png"
