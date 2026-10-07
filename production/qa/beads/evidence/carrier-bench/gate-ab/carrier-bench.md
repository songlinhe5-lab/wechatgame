# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）

> 档位 = **`[E]` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；
> ⛔ 本组读数**不构成** `ADR-0022 D2` 的「≥2 台低端同向」达线证据。

生成：2026-10-05T02:11:20.288Z · frames=150 · warmup=40 · gpuProbe=true · disturb=false · gates=off,on

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
vector | 0.6  | off  | 2031 | 0     | 14 | 37170 | 4.40     | 4.60     | 150    | 150   | 3.00     | 3.30     | 16.80     | 2.26    | 2.86    | 149   | —          | 0          | 0     | 0     | 128    | 4  
vector | 0.6  | on   | 2031 | 0     | 14 | 37170 | 1.20     | 1.40     | 150    | 3     | 5.70     | 6.80     | 16.70     | 2.51    | 2.54    | 3     | —          | 0          | 0     | 0     | 128    | 3  
vector | 1    | off  | 2031 | 0     | 14 | 38194 | 4.50     | 5.00     | 150    | 150   | 3.20     | 3.70     | 16.70     | 2.45    | 3.85    | 149   | —          | 0          | 0     | 0     | 128    | 3  
vector | 1    | on   | 2031 | 0     | 14 | 38194 | 1.30     | 1.50     | 150    | 2     | 5.20     | 5.20     | 16.60     | 2.91    | 2.91    | 2     | —          | 0          | 0     | 0     | 128    | 2  
vector | 2    | off  | 1916 | 0     | 15 | 55145 | 5.00     | 5.90     | 150    | 150   | 3.90     | 4.70     | 16.60     | 2.87    | 3.90    | 149   | —          | 0          | 0     | 0     | 128    | 4  
vector | 2    | on   | 1916 | 0     | 15 | 55145 | 1.10     | 1.80     | 150    | 3     | 7.30     | 8.50     | 16.70     | 2.80    | 4.35    | 3     | —          | 0          | 0     | 0     | 128    | 3  
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
      "max": 3.899999976158142
    },
    "frameMs": {
      "p50": 16.799999982118607,
      "p95": 17.599999994039536
    },
    "gpuMs": {
      "p50": 2.260958,
      "p95": 2.861666,
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
    "modelChanges": 4,
    "drawnFrames": 150,
    "gate": false,
    "tickMs": {
      "p50": 4.4000000059604645,
      "p95": 4.600000023841858,
      "n": 150
    },
    "disturb": false
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
      "p50": 5.700000017881393,
      "p95": 6.800000011920929,
      "max": 6.800000011920929
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 18.400000005960464
    },
    "gpuMs": {
      "p50": 2.508083,
      "p95": 2.538875,
      "n": 3
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 0,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 3,
    "drawnFrames": 3,
    "gate": true,
    "tickMs": {
      "p50": 1.2000000178813934,
      "p95": 1.4000000059604645,
      "n": 150
    },
    "disturb": false
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
      "p95": 3.7000000178813934,
      "max": 4.200000017881393
    },
    "frameMs": {
      "p50": 16.700000017881393,
      "p95": 18.299999982118607
    },
    "gpuMs": {
      "p50": 2.446291,
      "p95": 3.854041,
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
    "modelChanges": 3,
    "drawnFrames": 150,
    "gate": false,
    "tickMs": {
      "p50": 4.5,
      "p95": 5,
      "n": 150
    },
    "disturb": false
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
      "p50": 5.199999988079071,
      "p95": 5.199999988079071,
      "max": 5.199999988079071
    },
    "frameMs": {
      "p50": 16.599999994039536,
      "p95": 18.400000005960464
    },
    "gpuMs": {
      "p50": 2.9105,
      "p95": 2.9105,
      "n": 2
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 0,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 2,
    "drawnFrames": 2,
    "gate": true,
    "tickMs": {
      "p50": 1.2999999821186066,
      "p95": 1.5,
      "n": 150
    },
    "disturb": false
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
      "p95": 4.700000017881393,
      "max": 5.4000000059604645
    },
    "frameMs": {
      "p50": 16.599999994039536,
      "p95": 18.19999998807907
    },
    "gpuMs": {
      "p50": 2.873041,
      "p95": 3.896041,
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
    "modelChanges": 4,
    "drawnFrames": 150,
    "gate": false,
    "tickMs": {
      "p50": 5,
      "p95": 5.9000000059604645,
      "n": 150
    },
    "disturb": false
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
      "p50": 7.300000011920929,
      "p95": 8.5,
      "max": 8.5
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 18.5
    },
    "gpuMs": {
      "p50": 2.796791,
      "p95": 4.353791,
      "n": 3
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 0,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 3,
    "drawnFrames": 3,
    "gate": true,
    "tickMs": {
      "p50": 1.0999999940395355,
      "p95": 1.800000011920929,
      "n": 150
    },
    "disturb": false
  }
]
```
