const ROOT = '/Users/stephenhe/Development/workspace/wechatgame';
const STAGE = `${ROOT}/dev/harness/.smoke`;
const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);

function mk(key, levels) {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const events = new fw.EventBus(), input = new fw.InputManager();
    const storage = platform.createStorage();
    const services = {
        events, input, audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage,
        rng: fw.createRng('dbg'), viewport: new fw.Viewport(750, 1334),
        assets: new fw.NullAssetProvider(), platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const game = new BeadsGame({ saveKey: key, ...(levels ? { levels } : {}) });
    game.init(services);
    return { game, input, storage, services, key };
}
const step = 1 / 60;
const f = (h) => { h.input.beginFrame(); h.game.update(step); h.input.endFrame(step); };
const show = (tag, h) => {
    const s = h.game.snapshot;
    console.log(`${tag}: phase=${s.phase} mode=${s.mode ?? '-'} onboarding=${s.onboarding} guideSlot=${s.guideSlot} hint=(${s.hintRow},${s.hintCol}) holds=${s.traySlots.filter((x) => x.state !== 'free').length}/${s.traySlots.length}`);
};
const h = mk('wxgame.beads.dbg1');
show('f0(未推进)', h); f(h); show('f1', h); f(h); show('f2', h); f(h); show('f3', h);
console.log('save=', String(h.storage.get('wxgame.beads.dbg1')));
const h2 = mk('wxgame.beads.dbg2');
f(h2);
const s = h2.game.snapshot;
const i = s.cells.findIndex((c) => !c.void && c.state === 'empty' && c.colorIdx > 0);
const sl = h2.game.giveTrayBead(s.cells[i].colorIdx); h2.game.selectTraySlot(sl);
h2.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols); f(h2);
show('落子后', h2);
console.log('save2=', String(h2.storage.get('wxgame.beads.dbg2')));
const h3 = mk('wxgame.beads.dbg2'); f(h3); show('二次装配(同 key)', h3);
console.log('save3=', String(h3.storage.get('wxgame.beads.dbg2')));
