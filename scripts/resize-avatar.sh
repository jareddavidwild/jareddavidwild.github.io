#!/usr/bin/env bash
# Resize a provided avatar image to a web-friendly square (default 400x400) and write to assets/avatar.jpg
# Usage: ./scripts/resize-avatar.sh /path/to/photo.jpg

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
OUT_FILE="$ASSETS_DIR/avatar.jpg"

if [ $# -gt 0 ]; then
  SRC="$1"
else
  # try common source filenames
  if [ -f "$ASSETS_DIR/avatar-source.jpg" ]; then
    SRC="$ASSETS_DIR/avatar-source.jpg"
  elif [ -f "$ASSETS_DIR/avatar-source.png" ]; then
    SRC="$ASSETS_DIR/avatar-source.png"
  elif [ -f "$ASSETS_DIR/cloudIntelligence.png" ]; then
    SRC="$ASSETS_DIR/cloudIntelligence.png"
  else
    echo "No source avatar provided and no default found (avatar-source.jpg/png or cloudIntelligence.png)."
    echo "Usage: $0 /path/to/photo.jpg"
    exit 1
  fi
fi

echo "Resizing avatar from $SRC -> $OUT_FILE"

if command -v sips >/dev/null 2>&1; then
  # macOS sips: resize longest edge then crop to square
  tmp="$ASSETS_DIR/.avatar_tmp.jpg"
  sips -Z 400 "$SRC" --out "$tmp"
  # center-crop to 400x400 using sips (use -c for crop if available)
  sips -c 400 400 "$tmp" --out "$OUT_FILE" || mv "$tmp" "$OUT_FILE"
  rm -f "$tmp" || true
elif command -v convert >/dev/null 2>&1; then
  # ImageMagick convert
  convert "$SRC" -resize 400x400^ -gravity center -extent 400x400 -quality 85 "$OUT_FILE"
else
  echo "No supported image tool found (sips or ImageMagick 'convert'). Please install one or provide a pre-sized avatar at $OUT_FILE"
  exit 1
fi

echo "Avatar written to $OUT_FILE"
