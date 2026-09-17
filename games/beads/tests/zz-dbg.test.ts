import { describe, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { buildBeadsView } from '../src/view/view-model.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { DESIGN_W, DESIGN_H } from '../src/config/tuning.js';
describe('dbg gap10', () => {
  it('dump', () => {
    const h = createBeadsHarness({ levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.zz' });
    const base = h.game.snapshot;
    const snapLo = { ...base, urgent: true, pulseClock: 0 } as typeof base & { gridTop: number };
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildBeadsView(builder, snapLo, DEFAULT_PALETTE);
    const cmds = builder.end().commands;
    const circles = cmds.filter((c) => c.kind === 'circle');
    console.log('circles=', circles.length, 'gridTop=', (snapLo as unknown as { gridTop: number }).gridTop);
    for (const c of circles) console.log('circle y=', c.y, 'r=', c.r, 'stroke=', (c as { stroke?: string }).stroke, 'fill=', (c as { fill?: string }).fill);
  });
});
