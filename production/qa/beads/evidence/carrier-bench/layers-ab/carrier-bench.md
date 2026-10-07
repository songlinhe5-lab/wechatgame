# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）

> 档位 = **`[E]` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；
> ⛔ 本组读数**不构成** `ADR-0022 D2` 的「≥2 台低端同向」达线证据。

生成：2026-10-05T04:02:41.502Z · frames=150 · warmup=40 · gpuProbe=true · disturb=false · gates=on · layers=full,beads

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
arm   | zoom | gate | layers | cmds | blits | dc | tris | tick p50 | tick p95 | tick n | drawn | draw p50 | draw p95 | frame p50 | gpu p50 | gpu p95 | gpu n | upload p50 | upload B/f | cells | nodes | filled | chg
atlas | 0.6  | on   | full   | 479  | 280   | 15 | 3354 | 1.40     | 1.70     | 150    | 150   | 1.00     | 1.10     | 16.70     | 2.15    | 2.61    | 149   | —          | 0          | 7     | 280   | 128    | 4  
atlas | 0.6  | on   | beads  | 479  | 280   | 2  | 740  | 0.90     | 1.10     | 150    | 150   | 0.10     | 0.30     | 16.70     | 0.81    | 0.89    | 149   | —          | 0          | 7     | 280   | 128    | 4  
atlas | 1    | on   | full   | 479  | 280   | 15 | 3354 | 1.30     | 1.50     | 150    | 150   | 0.90     | 1.10     | 16.70     | 2.17    | 2.75    | 149   | —          | 0          | 7     | 280   | 128    | 3  
atlas | 1    | on   | beads  | 479  | 280   | 2  | 740  | 0.90     | 1.10     | 150    | 150   | 0.10     | 0.30     | 16.70     | 0.79    | 0.87    | 149   | —          | 0          | 7     | 280   | 128    | 3  
atlas | 2    | on   | full   | 452  | 264   | 15 | 3137 | 1.40     | 1.50     | 150    | 150   | 0.90     | 1.10     | 16.70     | 2.26    | 2.87    | 149   | —          | 0          | 7     | 280   | 128    | 4  
atlas | 2    | on   | beads  | 452  | 264   | 2  | 708  | 0.70     | 1.00     | 150    | 150   | 0.10     | 0.20     | 16.70     | 0.42    | 0.92    | 149   | —          | 0          | 7     | 280   | 128    | 4  
```

## 逐臂原始 JSON

```json
[
  {
    "arm": "atlas",
    "zoom": 0.6,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 15,
    "tris": 3354,
    "drawMs": {
      "p50": 1,
      "p95": 1.100000023841858,
      "max": 1.300000011920929
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.099999994039536
    },
    "gpuMs": {
      "p50": 2.149749,
      "p95": 2.611083,
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
    "modelChanges": 4,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 1.4000000059604645,
      "p95": 1.699999988079071,
      "n": 150
    },
    "disturb": false
  },
  {
    "arm": "atlas",
    "zoom": 0.6,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 2,
    "tris": 740,
    "drawMs": {
      "p50": 0.10000002384185791,
      "p95": 0.30000001192092896,
      "max": 0.30000001192092896
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.299999982118607
    },
    "gpuMs": {
      "p50": 0.813583,
      "p95": 0.888499,
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
    "modelChanges": 4,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "beads",
    "tickMs": {
      "p50": 0.9000000059604645,
      "p95": 1.100000023841858,
      "n": 150
    },
    "disturb": false
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
      "p95": 1.0999999940395355,
      "max": 1.300000011920929
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.19999998807907
    },
    "gpuMs": {
      "p50": 2.16675,
      "p95": 2.754249,
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
    "modelChanges": 3,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 1.300000011920929,
      "p95": 1.5,
      "n": 150
    },
    "disturb": false
  },
  {
    "arm": "atlas",
    "zoom": 1,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 2,
    "tris": 740,
    "drawMs": {
      "p50": 0.10000002384185791,
      "p95": 0.29999998211860657,
      "max": 0.4000000059604645
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17
    },
    "gpuMs": {
      "p50": 0.788791,
      "p95": 0.872916,
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
    "modelChanges": 3,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "beads",
    "tickMs": {
      "p50": 0.9000000059604645,
      "p95": 1.0999999940395355,
      "n": 150
    },
    "disturb": false
  },
  {
    "arm": "atlas",
    "zoom": 2,
    "frames": 150,
    "cmdsPerFrame": 452,
    "blitsPerFrame": 264,
    "drawCalls": 15,
    "tris": 3137,
    "drawMs": {
      "p50": 0.9000000059604645,
      "p95": 1.100000023841858,
      "max": 1.2000000178813934
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17
    },
    "gpuMs": {
      "p50": 2.258833,
      "p95": 2.866249,
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
    "modelChanges": 4,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 1.399999976158142,
      "p95": 1.5,
      "n": 150
    },
    "disturb": false
  },
  {
    "arm": "atlas",
    "zoom": 2,
    "frames": 150,
    "cmdsPerFrame": 452,
    "blitsPerFrame": 264,
    "drawCalls": 2,
    "tris": 708,
    "drawMs": {
      "p50": 0.09999999403953552,
      "p95": 0.20000001788139343,
      "max": 0.30000001192092896
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.599999994039536
    },
    "gpuMs": {
      "p50": 0.416791,
      "p95": 0.922291,
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
    "modelChanges": 4,
    "drawnFrames": 150,
    "gate": true,
    "atlasLayers": "beads",
    "tickMs": {
      "p50": 0.699999988079071,
      "p95": 1,
      "n": 150
    },
    "disturb": false
  }
]
```
