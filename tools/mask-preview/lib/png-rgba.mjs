/**
 * `[WXG-T-226 EP12-S1 / ADR-0029 DEC-3]` 极小 PNG 读入器（8-bit、非隔行、color type 2/6）。
 *
 * **为什么自带而不引依赖**：对拍门禁要读「定稿 py 产物」；仓内零 PNG 运行时依赖
 * （`check-bundle-size` / 包体红线不允许为一个测试工具加图形库），Node 内置 `zlib` 已足够。
 *
 * ⛔ 只读不改：不写 PNG（落盘由 py 侧 `export-cocos-textures*.py` 负责，它仍是资产产出真源）。
 */
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 读 PNG → `{ width, height, data }`，`data` 为交错 RGBA。 */
export function readPngRgba(path) {
    const buf = readFileSync(path);
    if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`not a PNG: ${path}`);

    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idat = [];

    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') {
            break;
        }
        pos += 12 + len;
    }

    if (bitDepth !== 8) throw new Error(`unsupported bitDepth ${bitDepth}: ${path}`);
    if (interlace !== 0) throw new Error(`interlaced PNG unsupported: ${path}`);
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
    if (channels === 0) throw new Error(`unsupported colorType ${colorType}: ${path}`);

    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const out = new Uint8Array(width * height * 4);
    const prior = new Uint8Array(stride);
    const line = new Uint8Array(stride);

    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? line[i - channels] : 0;
            const b = prior[i];
            const c = i >= channels ? prior[i - channels] : 0;
            let v = src[i];
            switch (filter) {
                case 0: break;
                case 1: v += a; break;
                case 2: v += b; break;
                case 3: v += (a + b) >> 1; break;
                case 4: {
                    const p = a + b - c;
                    const pa = Math.abs(p - a);
                    const pb = Math.abs(p - b);
                    const pc = Math.abs(p - c);
                    v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
                    break;
                }
                default: throw new Error(`bad PNG filter ${filter} at row ${y}: ${path}`);
            }
            line[i] = v & 0xff;
        }
        prior.set(line);
        for (let x = 0; x < width; x++) {
            const s = x * channels;
            const d = (y * width + x) * 4;
            out[d] = line[s];
            out[d + 1] = line[s + 1];
            out[d + 2] = line[s + 2];
            out[d + 3] = channels === 4 ? line[s + 3] : 255;
        }
    }
    return { width, height, data: out };
}
