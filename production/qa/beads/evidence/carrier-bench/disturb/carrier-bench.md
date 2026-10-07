# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）

> 档位 = **`[E]` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；
> ⛔ 本组读数**不构成** `ADR-0022 D2` 的「≥2 台低端同向」达线证据。

生成：2026-10-05T01:32:41.492Z · frames=150 · warmup=40 · gpuProbe=true · disturb=true

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
arm    | zoom | cmds | blits | dc | tris  | draw p50 | draw p95 | frame p50 | gpu p50 | gpu p95 | gpu n | upload p50 | upload B/f | cells | nodes | filled | chg
vector | 0.6  | 2031 | 0     | 14 | 37170 | 3.00     | 3.30     | 16.70     | 2.21    | 2.77    | 149   | —          | 0          | 0     | 0     | 128    | 150
vector | 1    | 2031 | 0     | 14 | 38194 | 3.20     | 3.50     | 16.60     | 2.31    | 2.82    | 149   | —          | 0          | 0     | 0     | 128    | 150
vector | 2    | 1916 | 0     | 15 | 55145 | 3.90     | 4.70     | 16.60     | 2.60    | 2.99    | 149   | —          | 0          | 0     | 0     | 128    | 150
canvas | 0.6  | 479  | 280   | 2  | 182   | 1.00     | 1.20     | 16.70     | 1.33    | 1.49    | 149   | 0.40       | 6031680    | 0     | 0     | 128    | 150
canvas | 1    | 479  | 280   | 2  | 182   | 0.90     | 1.50     | 16.70     | 0.71    | 1.42    | 149   | 0.30       | 6031680    | 0     | 0     | 128    | 150
canvas | 2    | 452  | 264   | 2  | 182   | 0.80     | 1.00     | 16.70     | 1.34    | 1.49    | 149   | 0.30       | 6031680    | 0     | 0     | 128    | 150
atlas  | 0.6  | 479  | 280   | 16 | 3354  | 1.10     | 1.40     | 16.70     | 2.25    | 2.92    | 149   | —          | 0          | 7     | 280   | 128    | 150
atlas  | 1    | 479  | 280   | 16 | 3354  | 1.00     | 1.20     | 16.70     | 2.14    | 2.97    | 149   | —          | 0          | 7     | 280   | 128    | 150
atlas  | 2    | 452  | 264   | 16 | 3137  | 1.00     | 1.20     | 16.70     | 2.38    | 3.02    | 149   | —          | 0          | 7     | 280   | 128    | 150
```

## 逐臂原始 JSON

```json
[
  {
    "arm": "vector",
    "zoom": 0.6,
    "frames": 150,
    "cmdsPerFrame": 2031,
    "blitsPerFrame": 0,
    "drawCalls": 14,
    "tris": 37170,
    "drawMs": {
      "p50": 3,
      "p95": 3.2999999821186066,
      "max": 3.5
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.30000001192093
    },
    "gpuMs": {
      "p50": 2.211875,
      "p95": 2.766416,
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
    "disturb": true
  },
  {
    "arm": "vector",
    "zoom": 1,
    "frames": 150,
    "cmdsPerFrame": 2031,
    "blitsPerFrame": 0,
    "drawCalls": 14,
    "tris": 38194,
    "drawMs": {
      "p50": 3.199999988079071,
      "p95": 3.5,
      "max": 4.200000017881393
    },
    "frameMs": {
      "p50": 16.599999994039536,
      "p95": 17.599999994039536
    },
    "gpuMs": {
      "p50": 2.305999,
      "p95": 2.819458,
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
    "disturb": true
  },
  {
    "arm": "vector",
    "zoom": 2,
    "frames": 150,
    "cmdsPerFrame": 1916,
    "blitsPerFrame": 0,
    "drawCalls": 15,
    "tris": 55145,
    "drawMs": {
      "p50": 3.9000000059604645,
      "p95": 4.699999988079071,
      "max": 5
    },
    "frameMs": {
      "p50": 16.600000023841858,
      "p95": 17.400000005960464
    },
    "gpuMs": {
      "p50": 2.602541,
      "p95": 2.991374,
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
    "disturb": true
  },
  {
    "arm": "canvas",
    "zoom": 0.6,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 2,
    "tris": 182,
    "drawMs": {
      "p50": 1,
      "p95": 1.199999988079071,
      "max": 1.7000000178813934
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.19999998807907
    },
    "gpuMs": {
      "p50": 1.333833,
      "p95": 1.490916,
      "n": 149
    },
    "uploadMs": {
      "p50": 0.3999999761581421,
      "p95": 0.5,
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
      "p50": 0.9000000059604645,
      "p95": 1.5,
      "max": 2
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.900000005960464
    },
    "gpuMs": {
      "p50": 0.708874,
      "p95": 1.424916,
      "n": 149
    },
    "uploadMs": {
      "p50": 0.30000001192092896,
      "p95": 0.5,
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
    "disturb": true
  },
  {
    "arm": "canvas",
    "zoom": 2,
    "frames": 150,
    "cmdsPerFrame": 452,
    "blitsPerFrame": 264,
    "drawCalls": 2,
    "tris": 182,
    "drawMs": {
      "p50": 0.800000011920929,
      "p95": 1,
      "max": 1.399999976158142
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.100000023841858
    },
    "gpuMs": {
      "p50": 1.343458,
      "p95": 1.487958,
      "n": 149
    },
    "uploadMs": {
      "p50": 0.30000001192092896,
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
    "disturb": true
  },
  {
    "arm": "atlas",
    "zoom": 0.6,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 16,
    "tris": 3354,
    "drawMs": {
      "p50": 1.0999999940395355,
      "p95": 1.399999976158142,
      "max": 1.4000000059604645
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.100000023841858
    },
    "gpuMs": {
      "p50": 2.246791,
      "p95": 2.920541,
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
    "disturb": true
  },
  {
    "arm": "atlas",
    "zoom": 1,
    "frames": 150,
    "cmdsPerFrame": 479,
    "blitsPerFrame": 280,
    "drawCalls": 16,
    "tris": 3354,
    "drawMs": {
      "p50": 1,
      "p95": 1.2000000178813934,
      "max": 2.300000011920929
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17
    },
    "gpuMs": {
      "p50": 2.138208,
      "p95": 2.973666,
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
    "disturb": true
  },
  {
    "arm": "atlas",
    "zoom": 2,
    "frames": 150,
    "cmdsPerFrame": 452,
    "blitsPerFrame": 264,
    "drawCalls": 16,
    "tris": 3137,
    "drawMs": {
      "p50": 1,
      "p95": 1.2000000178813934,
      "max": 1.4000000059604645
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17
    },
    "gpuMs": {
      "p50": 2.383375,
      "p95": 3.015708,
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
    "disturb": true
  }
]
```
