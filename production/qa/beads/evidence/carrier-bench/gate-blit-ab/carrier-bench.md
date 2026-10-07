# 三臂载体同宿主性能取证（WXG-T-247 / ADR-0030 S0·S2）

> 档位 = **`[E]` 桌面 web-mobile**（真引擎 + 真 GPU 提交，非低端机）；
> ⛔ 本组读数**不构成** `ADR-0022 D2` 的「≥2 台低端同向」达线证据。

生成：2026-10-05T04:19:21.497Z · frames=150 · warmup=40 · gpuProbe=true · disturb=false · gates=on · layers=full,beads

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
vector | 1    | on   | full   | 2031 | 0     | 14 | 38194 | 1.30     | 1.50     | 149    | 3     | 7.50     | 15.70    | 16.70     | 2.37    | 2.51    | 3     | —          | 0          | 0     | 0     | 128    | 3  
canvas | 1    | on   | full   | 479  | 280   | 2  | 182   | 0.40     | 0.50     | 150    | 3     | 1.20     | 1.40     | 16.70     | 1.33    | 1.43    | 3     | 0.50       | 6031680    | 0     | 0     | 128    | 3  
atlas  | 1    | on   | full   | 479  | 280   | 15 | 3354  | 0.40     | 0.50     | 150    | 2     | 2.40     | 2.40     | 16.70     | 1.93    | 1.93    | 2     | —          | 0          | 7     | 280   | 128    | 2  
atlas  | 1    | on   | beads  | 479  | 280   | 2  | 740   | 0.40     | 0.50     | 150    | 2     | 0.30     | 0.30     | 16.70     | 0.92    | 0.92    | 2     | —          | 0          | 7     | 280   | 128    | 2  
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
      "p50": 7.5,
      "p95": 15.699999988079071,
      "max": 15.699999988079071
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17
    },
    "gpuMs": {
      "p50": 2.370875,
      "p95": 2.508166,
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
    "atlasLayers": "full",
    "tickMs": {
      "p50": 1.2999999821186066,
      "p95": 1.5,
      "n": 149
    },
    "disturb": false
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
      "p50": 1.2000000178813934,
      "p95": 1.4000000059604645,
      "max": 1.4000000059604645
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.5
    },
    "gpuMs": {
      "p50": 1.328583,
      "p95": 1.43425,
      "n": 3
    },
    "uploadMs": {
      "p50": 0.5,
      "p95": 0.5999999940395355,
      "n": 3
    },
    "uploadBytesPerFrame": 6031680,
    "atlasCells": 0,
    "atlasUploads": 0,
    "spriteNodes": 0,
    "tintSprites": 7,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 3,
    "drawnFrames": 3,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 0.4000000059604645,
      "p95": 0.5,
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
      "p50": 2.399999976158142,
      "p95": 2.399999976158142,
      "max": 2.399999976158142
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.599999994039536
    },
    "gpuMs": {
      "p50": 1.926458,
      "p95": 1.926458,
      "n": 2
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 7,
    "atlasUploads": 0,
    "spriteNodes": 280,
    "tintSprites": 7,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 2,
    "drawnFrames": 2,
    "gate": true,
    "atlasLayers": "full",
    "tickMs": {
      "p50": 0.4000000059604645,
      "p95": 0.5,
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
      "p50": 0.29999998211860657,
      "p95": 0.29999998211860657,
      "max": 0.29999998211860657
    },
    "frameMs": {
      "p50": 16.69999998807907,
      "p95": 17.5
    },
    "gpuMs": {
      "p50": 0.924374,
      "p95": 0.924374,
      "n": 2
    },
    "uploadMs": null,
    "uploadBytesPerFrame": 0,
    "atlasCells": 7,
    "atlasUploads": 0,
    "spriteNodes": 280,
    "tintSprites": 7,
    "filledCells": 128,
    "gpuMethod": "timer",
    "modelChanges": 2,
    "drawnFrames": 2,
    "gate": true,
    "atlasLayers": "beads",
    "tickMs": {
      "p50": 0.4000000059604645,
      "p95": 0.5,
      "n": 150
    },
    "disturb": false
  }
]
```
