# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）

> 档位 = **`[E]` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；
> ⛔ 本组读数**不构成** `ADR-0022 D2` 的「≥2 台低端同向」达线证据。

生成：2026-10-05T04:19:54.232Z · frames=150 · warmup=40 · gpuProbe=true · disturb=true · gates=on · layers=full

## 宿主事实

```json
{
  "engine": "cocos-web-mobile",
  "ccScreenDevicePixelRatio": 2,
  "domDevicePixelRatio": 2,
  "canvasBackbuffer": [
    824,
    1830
  ],
  "cssViewport": [
    412,
    915
  ],
  "design": [
    750,
    1334
  ],
  "fitScale": 0.5493333333333333,
  "gpuRenderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Versio",
  "gpuIsSoftware": false,
  "gpuProbeMethod": "timer",
  "webgl2": true,
  "maxTextureSize": 16384,
  "maxVertexAttribs": 16,
  "timerQuery": true,
  "timerQueryTarget": 35007,
  "timerQueryExtKeys": [
    "QUERY_COUNTER_BITS_EXT",
    "TIME_ELAPSED_EXT",
    "TIMESTAMP_EXT",
    "GPU_DISJOINT_EXT",
    "queryCounterEXT"
  ],
  "gpuDisjoint": false
}
```

## 读数

```
arm    | zoom | gate | layers | cmds | blits | dc | tris  | tick p50 | tick p95 | tick n | drawn | draw p50 | draw p95 | frame p50 | gpu p50 | gpu p95 | gpu n | upload p50 | upload B/f | cells | nodes | filled | chg
vector | 1    | on   | full   | 2031 | 0     | 14 | 38194 | 5.10     | 6.90     | 150    | 150   | 3.10     | 4.80     | 16.70     | 2.63    | 3.92    | 149   | —          | 0          | 0     | 0     | 128    | 150
canvas | 1    | on   | full   | 479  | 280   | 2  | 182   | 1.40     | 1.60     | 150    | 150   | 0.70     | 0.90     | 16.80     | 1.40    | 1.49    | 149   | 0.30       | 6031680    | 0     | 0     | 128    | 150
atlas  | 1    | on   | full   | 479  | 280   | 15 | 3354  | 1.40     | 1.90     | 150    | 150   | 0.90     | 1.40     | 16.60     | 2.07    | 2.76    | 149   | —          | 0          | 7     | 280   | 128    | 150
```

## 逐臂原始 JSON

```json
[
  {
    "arm": "vector",
    "zoom": 1,
    "frames": 150,
    "cmdsPerFrame": 2031,
    "blitsPerFrame": 0,
    "drawCalls": 14,
    "tris": 38194,
    "drawMs": {
      "p50": 3.100000023841858,
      "p95": 4.800000011920929,
      "max": 7.199999988079071
    },
    "frameMs": {
      "p50": 16.700000017881393,
      "p95": 18.5
    },
    "gpuMs": {
      "p50": 2.628083,
      "p95": 3.92375,
      "n": 149
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 0,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 150,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 5.0999999940395355,
      "p95": 6.9000000059604645,
      "n": 150
    },
    "disturb": true
  },
  {
    "arm": "canvas",
    "zoom": 1,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 2,
    "tris": 182,
    "drawMs": {
      "p50": 0.7000000178813934,
      "p95": 0.9000000059604645,
      "max": 1.199999988079071
    },
    "frameMs": {
      "p50": 16.799999982118607,
      "p95": 18.19999998807907
    },
    "gpuMs": {
      "p50": 1.400624,
      "p95": 1.49175,
      "n": 149
    },
    "uploadMs": {
      "p50": 0.29999998211860657,
      "p95": 0.4000000059604645,
      "n": 150
    },
    "uploadBytesPerFrame": 6031680,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 7,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 150,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 1.399999976158142,
      "p95": 1.5999999940395355,
      "n": 150
    },
    "disturb": true
  },
  {
    "arm": "atlas",
    "zoom": 1,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 15,
    "tris": 3354,
    "drawMs": {
      "p50": 0.9000000059604645,
      "p95": 1.399999976158142,
      "max": 2.4000000059604645
    },
    "frameMs": {
      "p50": 16.600000023841858,
      "p95": 18.299999982118607
    },
    "gpuMs": {
      "p50": 2.071083,
      "p95": 2.761124,
      "n": 149
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 7,
    "atlasUploads": 0,
    "spriteNodes": 280,
    "tintSprites": 7,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 150,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 1.399999976158142,
      "p95": 1.899999976158142,
      "n": 150
    },
    "disturb": true
  }
]
```
