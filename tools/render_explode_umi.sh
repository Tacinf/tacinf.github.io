#!/usr/bin/env bash
# Render the 16-frame assembled -> exploded sequence for the Tacumi UMI.
#
# Requirements:
#   - Isaac Sim / Isaac Lab in ~/miniconda3/envs/isaac5
#   - the Tacinf paper repository at ~/docs/Tacinf-NVTech (override TACINF_PAPER)
#   - Pillow in the default python3
#
# Usage:
#   bash tools/render_explode_umi.sh
#
# Output: assets/img/explode/umi-00.webp ... umi-15.webp
# Keep FRAME_COUNT in assets/js/main.js in sync if you change N.
set -euo pipefail

SITE="$(cd "$(dirname "$0")/.." && pwd)"
PAPER="${TACINF_PAPER:-$HOME/docs/Tacinf-NVTech}"
PY="${ISAAC_PY:-$HOME/miniconda3/envs/isaac5/bin/python}"
N=16
RES="1600x900"
EXPLODED="$PAPER/figs/UMI_URDF/usd/handheld_umi_exploded.usd"
OUT="$SITE/assets/img/explode"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT" "$TMP"

for i in $(seq 0 $((N - 1))); do
  t=$(python3 -c "print($i / ($N - 1))")
  idx=$(printf "%02d" "$i")
  df=$(python3 -c "print(1.95 + (2.6 - 1.95) * $t)")

  "$PY" "$SITE/tools/explode_umi_usd.py" "$t" "$TMP/umi-$idx.usd"
  "$PY" "$SITE/tools/render_kit_preview_fixed.py" \
    "$TMP/umi-$idx.usd" "$TMP/umi-$idx.png" \
    --camera-usd "$EXPLODED" \
    --dir 0.2147,-0.9299,0.2987 --dist-factor "$df" \
    --res "$RES" --bg 0.30,0.30,0.30 --backdrop 0.378,0.477,0.400
  echo "rendered frame $idx"
done

python3 - "$TMP" "$OUT" <<'PY'
import sys
from pathlib import Path
from PIL import Image

tmp, out = Path(sys.argv[1]), Path(sys.argv[2])
total = 0
for path in sorted(tmp.glob("umi-*.png")):
    image = Image.open(path).convert("RGB")
    if image.width > 1400:
        image = image.resize((1400, round(image.height * 1400 / image.width)), Image.LANCZOS)
    dst = out / (path.stem + ".webp")
    image.save(dst, "WEBP", quality=82, method=6)
    total += dst.stat().st_size
    print(f"{dst.name} {image.width}x{image.height} {dst.stat().st_size / 1024:.1f} KB")
print(f"total {total / 1024:.1f} KB")
PY

echo "done -> $OUT"
