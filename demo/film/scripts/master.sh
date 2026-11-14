#!/usr/bin/env bash
# Masters a rendered film: two-pass loudnorm to -14 LUFS integrated, true peak -1 dBTP (audio re-encoded AAC 256k),
# then a 4x-oversampled peak limiter at -2 dBFS (AAC adds intersample overs; target <= -1 dBTP),
# and tags the H.264 stream limited-range Rec.709 without re-encoding the picture. Then prints the checks.
# Usage: scripts/master.sh in.mp4 out.mp4
set -euo pipefail
IN="$1"; OUT="$2"
read -r I TP LRA THRESH OFFSET < <(ffmpeg -hide_banner -nostats -i "$IN" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 \
  | python3 -c "import json,sys,re; t=sys.stdin.read(); d=json.loads(re.findall(r'\{[^{}]*\}', t)[-1]); print(d['input_i'], d['input_tp'], d['input_lra'], d['input_thresh'], d['target_offset'])")
echo "[master] measured: I=$I TP=$TP LRA=$LRA"
ffmpeg -hide_banner -v error -y -i "$IN" -map 0:v:0 -map 0:a:0 -c:v copy \
  -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0 \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$THRESH:offset=$OFFSET:linear=true,aresample=192000,alimiter=limit=0.79:attack=2:release=60:level=false,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart "$OUT"
echo "[master] wrote $OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,color_range,color_space,color_transfer,color_primaries,sample_rate,channels \
  -show_entries format=duration,size -of compact "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary:" | grep -E "I:|LRA:|Peak:"
echo "[master] full decode check:"; ffmpeg -v error -i "$OUT" -f null - && echo "decode ok"
