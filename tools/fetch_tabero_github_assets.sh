#!/usr/bin/env bash
# Fetch the Tabero GitHub demo GIFs and ICML 2026 poster, then build web assets.
# Source: https://github.com/NathanWu7/Tabero (docs/assets, Git LFS).
set -euo pipefail
SITE="$(cd "$(dirname "$0")/.." && pwd)"
OUT_IMG="$SITE/assets/img"
OUT_VID="$SITE/assets/video"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT_IMG" "$OUT_VID"

BASE="https://media.githubusercontent.com/media/NathanWu7/Tabero/main/docs/assets"
curl -sSL --max-time 120 "$BASE/poster_preview.png" -o "$TMP/poster.png"

python3 - "$TMP/poster.png" "$OUT_IMG/tabero-poster.webp" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
if im.width > 1800:
    im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
im.save(sys.argv[2], "WEBP", quality=88, method=6)
print("poster", im.size)
PY

# name -> GitHub GIF
for entry in \
  "milk-firm task7_firm_success.gif" \
  "milk-gentle task7_gentle_success.gif"; do
  set -- $entry
  name="$1"; file="$2"
  curl -sSL --max-time 120 "$BASE/$file" -o "$TMP/$name.gif"
  ffmpeg -loglevel error -y -i "$TMP/$name.gif" \
    -vf "fps=15,scale=640:-2" -c:v libx264 -profile:v main -pix_fmt yuv420p \
    -crf 27 -preset slow -movflags +faststart -an "$OUT_VID/tabero-demo-$name.mp4"
  ffmpeg -loglevel error -y -ss 0.5 -i "$TMP/$name.gif" -frames:v 1 "$TMP/$name.png"
  python3 - "$TMP/$name.png" "$OUT_IMG/poster-tabero-demo-$name.webp" <<'PY'
import sys
from PIL import Image
Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=82, method=6)
PY
  echo "demo $name"
done
