# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）

> 档位 = **`[E]` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；
> ⛔ 本组读数**不构成** `ADR-0022 D2` 的「≥2 台低端同向」达线证据。

生成：2026-10-05T02:12:03.449Z · frames=150 · warmup=40 · gpuProbe=true · disturb=true · gates=off,on

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
arm    | zoom | gate | cmds | blits | dc | tris  | tick p50 | tick p95 | tick n | drawn | draw p50 | draw p95 | frame p50 | gpu p50 | gpu p95 | gpu n | upload p50 | upload B/f | cells | nodes | filled | chg
vector | 0.6  | off  | 2031 | 0     | 14 | 37170 | 4.40     | 4.70     | 125    | 125   | 3.00     | 3.30     | 16.70     | 2.13    | 2.43    | 124   | —          | 0          | 0     | 0     | 128    | 102
vector | 0.6  | on   | 2031 | 0     | 14 | 37170 | 4.80     | 5.20     | 150    | 150   | 3.00     | 3.20     | 16.60     | 2.14    | 2.52    | 149   | —          | 0          | 0     | 0     | 128    | 150
vector | 1    | off  | 2031 | 0     | 14 | 38194 | 4.30     | 4.60     | 150    | 150   | 3.00     | 3.30     | 16.70     | 2.29    | 3.01    | 149   | —          | 0          | 0     | 0     | 128    | 150
vector | 1    | on   | 2031 | 0     | 14 | 38194 | 4.80     | 5.10     | 150    | 150   | 2.90     | 3.20     | 16.70     | 2.27    | 2.67    | 149   | —          | 0          | 0     | 0     | 128    | 150
vector | 2    | off  | 1916 | 0     | 15 | 55145 | 5.00     | 5.70     | 150    | 150   | 3.80     | 4.50     | 16.60     | 2.59    | 2.94    | 149   | —          | 0          | 0     | 0     | 128    | 150
vector | 2    | on   | 1916 | 0     | 15 | 55145 | 5.70     | 6.60     | 150    | 150   | 4.00     | 4.70     | 16.60     | 2.62    | 3.05    | 149   | —          | 0          | 0     | 0     | 128    | 150
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
      "p95": 3.300000011920929,
      "max": 3.7000000178813934
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 33.70000001788139
    },
    "gpuMs": {
      "p50": 2.125083,
      "p95": 2.428291,
      "n": 124
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 0,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 102,
    "drawnFrames": 125,
    "gate": false,
    "tickMs": {
      "p50": 4.399999976158142,
      "p95": 4.700000017881393,
      "n": 125
    },
    "disturb": true
  },
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
      "p95": 3.2000000178813934,
      "max": 4.299999982118607
    },
    "frameMs": {
      "p50": 16.599999994039536,
      "p95": 17.5
    },
    "gpuMs": {
      "p50": 2.138,
      "p95": 2.515666,
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
    "tickMs": {
      "p50": 4.800000011920929,
      "p95": 5.199999988079071,
      "n": 150
    },
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
      "p50": 3,
      "p95": 3.2999999821186066,
      "max": 3.5
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.400000005960464
    },
    "gpuMs": {
      "p50": 2.290833,
      "p95": 3.014041,
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
    "gate": false,
    "tickMs": {
      "p50": 4.300000011920929,
      "p95": 4.600000023841858,
      "n": 150
    },
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
      "p50": 2.9000000059604645,
      "p95": 3.199999988079071,
      "max": 4.799999982118607
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.30000001192093
    },
    "gpuMs": {
      "p50": 2.2695,
      "p95": 2.665874,
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
    "tickMs": {
      "p50": 4.799999982118607,
      "p95": 5.0999999940395355,
      "n": 150
    },
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
      "p50": 3.800000011920929,
      "p95": 4.5,
      "max": 4.799999982118607
    },
    "frameMs": {
      "p50": 16.599999994039536,
      "p95": 17.799999982118607
    },
    "gpuMs": {
      "p50": 2.589958,
      "p95": 2.93575,
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
    "gate": false,
    "tickMs": {
      "p50": 5,
      "p95": 5.699999988079071,
      "n": 150
    },
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
      "p50": 4,
      "p95": 4.700000017881393,
      "max": 6
    },
    "frameMs": {
      "p50": 16.599999994039536,
      "p95": 17.900000005960464
    },
    "gpuMs": {
      "p50": 2.615083,
      "p95": 3.046291,
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
    "tickMs": {
      "p50": 5.700000017881393,
      "p95": 6.5999999940395355,
      "n": 150
    },
    "disturb": true
  }
]
```
