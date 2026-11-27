#!/usr/bin/env bash
# Renders tools/share-kit/frames/*.html to public/share-kit/ at exact sizes.
set -euo pipefail
cd "$(dirname "$0")/../.."
declare -A SIZES=(
  [linkedin-card]="1200,627"
  [whatsapp-status-1]="1080,1920"
  [whatsapp-status-2]="1080,1920"
  [instagram-post]="1080,1350"
  [ph-problem]="1270,760"
  [ph-beam]="1270,760"
  [ph-rebalance]="1270,760"
)
mkdir -p public/share-kit
fail=0
for name in linkedin-card whatsapp-status-1 whatsapp-status-2 instagram-post ph-problem ph-beam ph-rebalance; do
  src="tools/share-kit/frames/$name.html"
  out="public/share-kit/$name.png"
  [ -f "$src" ] || { echo "SKIP (no frame): $src"; continue; }
  npx playwright screenshot --viewport-size "${SIZES[$name]}" --wait-for-timeout 2500 "file://$(pwd)/$src" "$out"
done
for name in linkedin-card whatsapp-status-1 whatsapp-status-2 instagram-post ph-problem ph-beam ph-rebalance; do
  [ -f "public/share-kit/$name.png" ] || { echo "MISSING: $name.png"; fail=1; }
done
exit $fail
