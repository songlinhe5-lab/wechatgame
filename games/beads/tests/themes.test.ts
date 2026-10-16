import { describe, expect, it } from 'vitest';

import { OPEN_THEMES, THEME_COMING_SOON, THEME_LEVEL_MAX, THEMES } from '../src/config/themes.js';

describe('主题列表', () => {
  it('开放数就是本版主题关数，且落在表的前几行', () => {
    expect(THEME_LEVEL_MAX).toBeGreaterThan(0);
    expect(THEMES.length).toBeGreaterThanOrEqual(THEME_LEVEL_MAX);
    expect(OPEN_THEMES).toHaveLength(THEME_LEVEL_MAX);
    expect(OPEN_THEMES.map((t) => t.id)).toEqual(THEMES.slice(0, THEME_LEVEL_MAX).map((t) => t.id));
    expect(THEME_COMING_SOON.length).toBeGreaterThan(0);
  });

  it('id 和 textureId 都不重复，每行都有名字、包和图', () => {
    const ids = THEMES.map((t) => t.id);
    const tex = THEMES.map((t) => t.textureId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(tex).size).toBe(tex.length);
    for (const t of THEMES) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.bundle.length).toBeGreaterThan(0);
      expect(t.art.length).toBeGreaterThan(0);
    }
  });
});
