// 参考图源生成（配合 temp/beads-gen.mjs 的 --in 验证用，spike 临时件）。
// 画两张 720×720 的拼豆友好源图：flower.png（多色均衡·好例子）/ heart.png（单色主导·坏例子）。
// 用法： node temp/beads-ref.mjs [outDir]   默认 temp/beads-ref
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

let chromium = null;
for (const c of [
  join(homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
  join(process.cwd(), 'node_modules'),
]) {
  try { chromium = createRequire(join(c, 'package.json'))('playwright').chromium; break; } catch {}
}
if (!chromium) { console.error('playwright/chromium 不可解析'); process.exit(3); }

// 拼豆色板前 8 色（view/palette.ts）
const C = {
  white: '#FFFFFF', yellow: '#FFD23F', orange: '#F59B23', green: '#3FBF6B',
  red: '#E84C3D', purple: '#8E6FD9', blue: '#3D7BF5', brown: '#A5652C',
};
const S = 720; // 20px/格 × 36 格
const outDir = process.argv[2] || join(process.cwd(), 'temp/beads-ref');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function draw(fn, name) {
  const url = await page.evaluate(
    ({ S, C, src }) => {
      const cv = document.createElement('canvas');
      cv.width = S; cv.height = S;
      const g = cv.getContext('2d');
      g.fillStyle = C.white; g.fillRect(0, 0, S, S);
      const cx = S / 2, cy = S / 2;
      const ell = (x, y, rx, ry, rot, fill) => {
        g.save(); g.translate(x, y); g.rotate(rot || 0);
        g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = fill; g.fill(); g.restore();
      };
      // eslint-disable-next-line no-new-func
      new Function('g', 'cx', 'cy', 'C', 'ell', 'return (' + src + ')(g,cx,cy,C,ell);')(g, cx, cy, C, ell);
      return cv.toDataURL('image/png');
    },
    { S, C, src: fn.toString() },
  );
  writeFileSync(join(outDir, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}

// flower：8 花瓣(红/橙交替) + 黄心 + 绿茎叶 —— 4 色近均衡，好例子
await draw((g, cx, cy, C, ell) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(a) * 150, py = cy - 120 + Math.sin(a) * 150;
    ell(px, py, 62, 34, a, i % 2 ? C.red : C.orange);
  }
  g.beginPath(); g.arc(cx, cy - 120, 74, 0, Math.PI * 2); g.fillStyle = C.yellow; g.fill();
  g.fillStyle = C.green; g.fillRect(cx - 12, cy - 40, 24, 250);
  ell(cx - 70, cy + 150, 70, 30, -0.5, C.green);
  ell(cx + 70, cy + 190, 70, 30, 0.5, C.green);
}, 'flower');

// heart：整颗大红心 + 白底 —— 单色主导，坏例子（演示配色平衡被迫改判）
await draw((g, cx, cy, C, ell) => {
  ell(cx - 95, cy - 60, 105, 105, 0, C.red);
  ell(cx + 95, cy - 60, 105, 105, 0, C.red);
  g.beginPath();
  g.moveTo(cx - 195, cy - 20); g.lineTo(cx, cy + 230); g.lineTo(cx + 195, cy - 20);
  g.closePath(); g.fillStyle = C.red; g.fill();
}, 'heart');

await browser.close();
console.log(`参考图 → ${outDir}/{flower.png, heart.png}  (${S}×${S}px, 20px/格 @36格)`);
