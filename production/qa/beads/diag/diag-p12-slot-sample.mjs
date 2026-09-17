import { resolve } from 'node:path';
const ROOT = '/Users/stephenhe/Development/workspace/wechatgame';
const STAGE = `${ROOT}/dev/harness/.smoke`;
const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);
const T = await import(`${STAGE}/games/beads/src/config/tuning.js`);

const cols = T.GRID_MAX_COLS, rowsN = T.GRID_MAX_ROWS;
const pattern = [];
for (let i = 0; i < rowsN; i++) { let line = ''; for (let j = 0; j < cols; j++) line += String(((i * cols + j) % 4) + 1); pattern.push(line); }
const lvl = [{ id: 1, name: 'x', cols, rows: rowsN, time: 420, spawnInterval: 2.0, decoys: [], pattern }];
const step = 1 / 60;
const chi = (h) => { const exp = 200 / h.length; return h.reduce((a, o) => a + ((o - exp) ** 2) / exp, 0).toFixed(2); };

for (const seed of ['chi', 'a2', 'a3']) {
    const mkGame = (key) => {
        const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
        const events = new fw.EventBus(), input = new fw.InputManager();
        const services = {
            events, input, audio: new fw.AudioScheduler(new fw.NullAudioBackend()),
            storage: platform.createStorage(), rng: fw.createRng(seed),
            viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(),
            platform: platform.info, rewardedAd: platform.createRewardedAdProvider(),
        };
        const game = new BeadsGame({ saveKey: key, levels: lvl });
        const spawns = [];
        events.on('tray:spawned', (p) => spawns.push(p));
        game.init(services);
        return { game, input, spawns, services };
    };
    const A = mkGame('wxgame.beads.scratchA');
    let f = 0;
    while (A.spawns.length < 200 && f < 60 * 4000) { A.input.beginFrame(); A.game.update(step); A.input.endFrame(step); f++; }
    const histA = new Array(T.TRAY_BASE_SLOTS).fill(0);
    for (const s of A.spawns.slice(0, 200)) histA[s.slot]++;

    const B = mkGame('wxgame.beads.scratchB');
    let f2 = 0;
    while (B.spawns.length < 200 && f2 < 60 * 4000) {
        B.input.beginFrame(); B.game.update(step); B.input.endFrame(step); f2++;
        const slots = B.game.snapshot.traySlots;
        const idx = []; for (let i = 0; i < slots.length; i++) if (slots[i].state !== 'free') idx.push(i);
        if (idx.length) B.game.tray.clearSlots(idx);
    }
    const histB = new Array(T.TRAY_BASE_SLOTS).fill(0);
    for (const s of B.spawns.slice(0, 200)) histB[s.slot]++;
    console.log(`seed=${seed} A(自然累积,${f}帧,n=${A.spawns.length}) hist=[${histA}] chi2=${chi(histA)}`);
    console.log(`seed=${seed} B(每帧排水,${f2}帧,n=${B.spawns.length}) hist=[${histB}] chi2=${chi(histB)}`);
    console.log(`   holdA=${A.game.snapshot.traySlots.filter((x) => x.state !== 'free').length}/${T.TRAY_BASE_SLOTS} expandedA=${A.game.snapshot.traySlots.length}`);
}
const g = fw.createRng('chi');
console.log('rng createRng("chi").next() x12 =', Array.from({ length: 12 }, () => Number(g.next().toFixed(4))));
