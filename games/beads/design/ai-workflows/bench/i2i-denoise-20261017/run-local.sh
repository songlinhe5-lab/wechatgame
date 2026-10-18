#!/bin/bash
# 本地 i2i 对照（denoise 0.9，同参考图 ref-1152x2048.png，同描述体 prompt.txt）
set -e
cd "$(dirname "$0")/../../../../../.."
P="$(cat games/beads/design/ai-workflows/bench/i2i-denoise-20261017/prompt.txt)"
W=games/beads/design/ai-workflows/workflows/qwen-image-2.1-turbo-i2i.api.json
H=http://192.168.1.16:8188
R=temp/i2i/ref-1152x2048.png
for S in 7; do
  python3 games/beads/design/ai-workflows/submit-comfyui.py --host $H --workflow $W --image $R \
    --override "8:denoise=0.9" --prompt "$P" --seed $S --timeout 900 \
    --out temp/comfyui-out/bench-local-turbo-d09-s$S
  python3 games/beads/design/ai-workflows/submit-comfyui.py --host $H --workflow $W --image $R \
    --override "8:steps=25" --override "8:scheduler=simple" --override "8:denoise=0.9" \
    --prompt "$P" --seed $S --timeout 900 --out temp/comfyui-out/bench-local-21-d09-s$S
done
echo LOCAL_DONE
