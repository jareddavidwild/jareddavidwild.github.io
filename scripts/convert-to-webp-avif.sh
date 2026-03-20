#!/usr/bin/env bash
# Convert optimized images to WebP and AVIF if converter tools are available.
# Uses cwebp (from webp) and avifenc (from libavif). This script is optional and
# is safe to run on machines that have these binaries installed.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets/optimized"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "Optimized assets dir not found: $ASSETS_DIR"
  exit 0
fi

for img in "$ASSETS_DIR"/*.{jpg,jpeg,png}; do
  [ -e "$img" ] || continue
  base="${img%.*}"
  if command -v cwebp >/dev/null 2>&1; then
    echo "Converting $img -> ${base}.webp"
    cwebp -q 80 "$img" -o "${base}.webp" || true
  fi
  if command -v avifenc >/dev/null 2>&1; then
    echo "Converting $img -> ${base}.avif"
    avifenc -q 50 "$img" "${base}.avif" || true
  fi
done

echo "Conversion complete (if tools were available)."
