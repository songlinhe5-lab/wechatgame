import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as barrel from '../src/config/tuning.js';

const REPO = resolve(import.meta.dirname, '../../..');
const DOMAIN_MODULES = [
  'layout',
  'visual',
  'board',
  'gameplay',
  'menu',
  'motion',
  'bead-style',
  'audio',
  'powerup-layout',
] as const;

describe('WXG-T-420 T3 · tuning 分域 barrel 兼容', () => {
  it('每个域模块的运行时导出都由原入口同引用再导出', async () => {
    for (const name of DOMAIN_MODULES) {
      const path = resolve(REPO, `games/beads/src/config/tuning/${name}.ts`);
      expect(existsSync(path), `缺少 tuning 域模块：${name}`).toBe(true);
      const domain = await import(pathToFileURL(path).href) as Record<string, unknown>;
      const keys = Object.keys(domain);
      expect(keys.length, `tuning/${name} 不得是空模块`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key in barrel, `barrel 漏再导出 ${name}.${key}`).toBe(true);
        expect(barrel[key as keyof typeof barrel], `barrel 导出身份漂移：${name}.${key}`).toBe(domain[key]);
      }
    }
  });
});
