#!/usr/bin/env bash
# Resize large images to more web-friendly sizes using sips (macOS).
# Creates ./assets/optimized/ and writes resized images there.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
OUT_DIR="$ASSETS_DIR/optimized"

mkdir -p "$OUT_DIR"

# Resize highresSpace.jpg to max width 1920
if [ -f "$ASSETS_DIR/highresSpace.jpg" ]; then
  echo "Resizing highresSpace.jpg -> optimized/highresSpace.jpg (max width 1920)"
  sips -Z 1920 "$ASSETS_DIR/highresSpace.jpg" --out "$OUT_DIR/highresSpace.jpg"
else
  echo "Warning: $ASSETS_DIR/highresSpace.jpg not found, skipping"
fi

# Resize wideFire.jpeg to max width 1600
if [ -f "$ASSETS_DIR/wideFire.jpeg" ]; then
  echo "Resizing wideFire.jpeg -> optimized/wideFire.jpeg (max width 1600)"
  sips -Z 1600 "$ASSETS_DIR/wideFire.jpeg" --out "$OUT_DIR/wideFire.jpeg"
else
  echo "Warning: $ASSETS_DIR/wideFire.jpeg not found, skipping"
fi

# Copy other small assets unchanged so imports remain valid
for f in cloudIntelligence.png avatar.jpg cubeTexture.jpg moonSurface.jpg normalMoon.jpeg; do
  if [ -f "$ASSETS_DIR/$f" ]; then
    cp "$ASSETS_DIR/$f" "$OUT_DIR/$f"
  fi
done

echo "Optimized images written to $OUT_DIR"
