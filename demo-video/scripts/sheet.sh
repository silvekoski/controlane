#!/bin/bash
# Makes a 2 x 3 contact sheet from a video. Usage: scripts/sheet.sh <video> <out.png> <frame>...
set -e
video=$1; out=$2; shift 2
tmp=$(mktemp -d)
i=0
for fr in "$@"; do
  ffmpeg -v error -y -ss $(echo "scale=3; $fr/30" | bc) -i "$video" -frames:v 1 -vf "drawtext=text='$fr':x=10:y=10:fontsize=22:fontcolor=red" "$tmp/$i.png" 2>/dev/null || ffmpeg -v error -y -ss $(echo "scale=3; $fr/30" | bc) -i "$video" -frames:v 1 "$tmp/$i.png"
  i=$((i+1))
done
inputs=""; labels=""
for k in $(seq 0 $((i-1))); do inputs="$inputs -i $tmp/$k.png"; labels="$labels[$k:v]"; done
ffmpeg -v error -y $inputs -filter_complex "${labels}xstack=inputs=$i:layout=0_0|w0_0|0_h0|w0_h0|0_h0+h1|w0_h0+h1[v]" -map "[v]" "$out"
rm -rf "$tmp"
