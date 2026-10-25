#!/bin/bash
# Usage: scripts/review.sh <scene numbers...>  Renders sampled stills per scene and one contact sheet each.
PY=/private/tmp/claude-501/-Users-veikka-car-delivery-control-room/ff9276b4-df50-4e72-9779-36c14a1363c8/scratchpad/venv/bin/python
specs=""
for n in "$@"; do specs="$specs $(grep "^$n " out/specs.txt | cut -d' ' -f2-)"; done
node scripts/stills.mjs $specs 2>&1 | grep -v -E "Bundling|^ok"
for n in "$@"; do
  files=""
  for s in $(grep "^$n " out/specs.txt | cut -d' ' -f2-); do files="$files out/stills/${s/:/-}.png"; done
  $PY scripts/sheet.py out/stills/sh$n.png $files
done
