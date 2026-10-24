/**
 * S9 设置与音频通道（pause-settings / save-progress §2.2 即写族）。
 *
 * 自 `beads-game.ts` 拆出（BeadsGame 重构 · 协作类 ②）：十个设置值的内存镜像、
 * 「开关切换即写档」、换肤单点、两条音频通道（bgm = 循环 clip 的启停；sfx = 请求门）全部收在这里。
 * 宿主只交出存档 / 服务 / 换 `palette` 引用 / 发震动事件四个口子（均惰性读：`init()` 后才有 save 与 services）。
 */
import type { GameServices, SaveManager } from '../../../framework/index';
import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_DENIED,
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_URGENT_BEAT,
  AUDIO_REJECT_MIN_INTERVAL,
  AUDIO_SFX_MIN_INTERVAL,
  AUDIO_TRAYFULL_MIN_INTERVAL,
  AUDIO_URGENT_MIN_INTERVAL,
  BEAD_SIZE_DEFAULT,
  BEAD_SIZE_ORDER,
  DENIED_PRESS_RESTART_GATE_MS,
  VIBRATE_DEFAULT,
} from '../../config/tuning';
import { DEFAULT_SKIN, DEFAULT_SKIN_ID, registeredSkins, skinById } from '../../config/skins/registry';
import type { PausePanelAction } from '../../systems/pause-panel';
import { DEFAULT_BEAD_STYLE_ID, registeredStyles } from '../../view/bead-styles/registry';
import type { BeadsPalette } from '../../view/palette';
import type { BeadsSave, BeadsSettings } from '../save-schema';

/**
 * §3.2 限流分档（真源：`audio-events.md §3.2` ↔ `systems-index §3.12`）。
 *
 * **一刀切 0.05 是缺陷**（冲突登记 C-A05-4）：那会让 `sfx_reject` 跑到 20 次/秒，
 * 直接违反 §3.8「错误反馈 ≤2 次/秒」。未列出的 clip = 一次性事件音 ⇒ `0`
 * （不限流），因为状态机天然单次触发（过关 / 结算 / 面板 / 续时 / stage）。
 */
const SFX_MIN_INTERVAL: Readonly<Record<string, number>> = {
  [AUDIO_CLIP_REJECT]: AUDIO_REJECT_MIN_INTERVAL,
  [AUDIO_CLIP_URGENT_BEAT]: AUDIO_URGENT_MIN_INTERVAL,
  [AUDIO_CLIP_TRAY_FULL]: AUDIO_TRAYFULL_MIN_INTERVAL,
  [AUDIO_CLIP_PLACE]: AUDIO_SFX_MIN_INTERVAL,
  [AUDIO_CLIP_SELECT]: AUDIO_SFX_MIN_INTERVAL,
  // G7 `sfx_denied`（裁定 3 ⑥ / Q-A05-5）：minInterval = 同格视觉门换算（/1000），
  // **不新造数值**（`assets-spec §1.6.7` 音频行）。
  [AUDIO_CLIP_DENIED]: DENIED_PRESS_RESTART_GATE_MS / 1000,
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface GameSettingsHost {
  readonly save: SaveManager<BeadsSave> | null;
  readonly services: GameServices | null;
  /** 换肤 = 换 `palette` 引用（arch.md D2：⛔ 禁 `Object.assign` 全局突变），下一帧生效。 */
  applyPalette(tokens: BeadsPalette): void;
  /** §3.8 震动开关：发 `settings:vibrate`（§4 meta 事件）。 */
  emitVibrate(on: boolean): void;
  /**
   * `[WXG-T-363]` 皮肤**买断拥有态**（真源 = `MetaState.ownsSkin`，经 `BeadsGameOptions.ownsSkin` 下传）。
   * `§3.7` v1.83「外观 = 金币买断」⇒ 穿肤只得在已拥有集合内发；未注入（无经济层的宿主 / 旧测试）
   * ⇒ **不设门**，行为逐字回到注入前。
   */
  ownsSkin?(skinId: string): boolean;
}

export class GameSettings {
  private readonly _v: Mutable<BeadsSettings> = {
    bgmMuted: false,
    sfxMuted: false,
    reduceMotion: false,
    largeText: false,
    vibrate: VIBRATE_DEFAULT,
    debugInfo: false,
    debugGuides: false,
    beadStyle: DEFAULT_BEAD_STYLE_ID,
    beadSize: BEAD_SIZE_DEFAULT,
    skinId: DEFAULT_SKIN_ID,
  };

  constructor(private readonly _host: GameSettingsHost) {}

  /** 十个设置值的只读视图（snapshot / getter 读它；写入只经本类方法）。 */
  get values(): Readonly<BeadsSettings> {
    return this._v;
  }

  /** `init()` 读档装载：整对象镜像 + 换 tokens 引用 + 按 bgm 静音态启停背景乐。 */
  load(s: BeadsSettings): void {
    Object.assign(this._v, s);
    // EP12-S8：皮肤 id 同批装载并换 tokens 引用（未注册 id 的读档层降级 + 渲染侧
    // `?? DEFAULT_SKIN` 最后防线双保险，T-267 mvp A4）。
    this.applySkin(s.skinId);
    this.applyAudioChannels();
  }

  /**
   * 受理设置类面板动作（暂停面板与主菜单设置 overlay 共用 ⇒ 两入口状态恒一致）。
   * 只管八个开关 / 循环动作；debug 两开关带 `_frameMs` 副作用，留在宿主。其余动作零作用。
   */
  apply(action: PausePanelAction): void {
    const v = this._v;
    switch (action) {
      case 'toggle-bgm':
        v.bgmMuted = !v.bgmMuted;
        this.applyAudioChannels();
        this.persist();
        return;
      case 'toggle-sfx':
        v.sfxMuted = !v.sfxMuted;
        this.persist();
        return;
      case 'toggle-reduce-motion':
        // D1：写档 + 经 snapshot 回显给 view（不切相位）。
        v.reduceMotion = !v.reduceMotion;
        this.persist();
        return;
      case 'toggle-large-text':
        // E2：同上。
        v.largeText = !v.largeText;
        this.persist();
        return;
      case 'toggle-vibrate':
        // §3.8：写档 + 发 `settings:vibrate`（不切相位）。
        v.vibrate = !v.vibrate;
        this.persist();
        this._host.emitVibrate(v.vibrate);
        return;
      case 'cycle-bead-style':
        this._cycleBeadStyle();
        return;
      case 'cycle-bead-size':
        this._cycleBeadSize();
        return;
      case 'cycle-skin':
        this._cycleSkin();
        return;
      default:
        return;
    }
  }

  setDebugInfo(on: boolean): void {
    this._v.debugInfo = on;
    this.persist();
  }

  setDebugGuides(on: boolean): void {
    this._v.debugGuides = on;
    this.persist();
  }

  /**
   * Persist a settings change immediately (save-progress §2.2: 开关切换即写).
   * The whole `settings` object is patched in one write, so a same-frame pair
   * of toggles never produces two documents (§6 idempotence).
   */
  persist(): void {
    const save = this._host.save;
    if (!save) return;
    save.patch({ settings: { ...this._v } });
    save.save();
  }

  /**
   * **皮肤换引用单点**（EP12-S8）：写 `skinId` 镜像 + 换 `palette` 实例引用。
   * 未注册 id 的**渲染侧最后防线** = `skinById ?? DEFAULT_SKIN`（同 `styleById` 回落
   * 判例；读档层 `normalizeSettings` 已先降级一层，本防线由测试钉住）。
   * ⛔ 禁插值/过渡帧（styleId 先例：下一帧生效）；⛔ 不动珠色墨水（皮肤作用域 =
   * UI 令牌族，arch.md D4 —— 本函数只换 `palette`，`inksCache` 与珠面零涉）。
   */
  applySkin(id: string): void {
    this._v.skinId = id;
    this._host.applyPalette((skinById(id) ?? DEFAULT_SKIN).tokens);
  }

  /**
   * **定向穿档**（WXG-T-363 · 装扮馆点卡）：与 `_cycleSkin` 同一道买断门（⛔ 不花钱切到未买断肤）。
   * 两条零副作用分支：① 已是当前档 ⇒ 零写档；② 未拥有且宿主给了拥有态查询 ⇒ 零写档（不静默降级）。
   * 宿主未注入 `ownsSkin` ⇒ 不设门（无经济层的旧链逐字不变）。一次调用恰写档 1 次（S9 §8-16）。
   */
  wearSkin(id: string): void {
    if (this._v.skinId === id) return;
    if (this._host.ownsSkin && !this._host.ownsSkin(id)) return;
    this.applySkin(id);
    this.persist();
  }

  /**
   * Sfx request gate (never touched by the music toggle, §8-4).
   *
   * `minInterval` 按 clip 分档（§3.2）——**不得**回到统一 0.05（那会把 reject 推成
   * 20 次/秒，违反 §3.8 红线，判据 A05-05/06）。
   */
  sfx(clipId: string): void {
    if (this._v.sfxMuted) return;
    this._host.services?.audio.play(clipId, { minInterval: SFX_MIN_INTERVAL[clipId] ?? 0 });
  }

  /**
   * Apply both channels to the audio layer.
   *
   * Deviation note (reported to the lead): architecture-beads §2 proposes two
   * `AudioScheduler` instances sharing one `AudioBackend`, but a game only ever
   * receives `GameServices.audio` — the `Platform` (which owns
   * `createAudioBackend()`, `platform/platform.ts`) is created inside `App`
   * (`compose/app.ts`) and is not reachable from `GameServices`
   * (`core/game/game.ts`). ADR-0013 (WXG-T-096) widened that factory to
   * `createAudioBackend({ voices })` — the recipe table now flows game → App →
   * Platform — but it deliberately did **not** hand the backend itself to the
   * game, so the two-scheduler shape still needs a further framework decision.
   *
   * Instead the two channels are realised over the single scheduler:
   *   - **bgm** = one looping clip; muting stops it, un-muting re-requests it;
   *   - **sfx** = a request gate; a muted sfx channel never queues anything.
   * Both behaviours are observable independently, which is what §8-4 asserts.
   */
  applyAudioChannels(): void {
    const services = this._host.services;
    if (!services) return;
    if (this._v.bgmMuted) {
      services.audio.stop(AUDIO_CLIP_BGM);
    } else {
      services.audio.play(AUDIO_CLIP_BGM, { loop: true });
    }
  }

  /**
   * **行4 左格「珠子风格」循环**（EP11-S5 / S9 v1.7 §2.2、§8-15/§8-16）。
   *
   * 循环序 = `registry` **注册序**（§8-15 真源；本函数不重排也不排序）；到达末档回绕到
   * 首档。当前 id 不在注册表内（理论不可达：读档已在 `normalizeSettings` 降级）⇒ 落 index 0，
   * ⛔ 不静默留档、也不新增事件名（S8 §8-12「不新造事件」）。
   *
   * 三条硬约束：① 每次调用 `persist()` **恰 1 次**（S9 §8-16「各写各字段恰 1 次」——
   * 本函数只动 `beadStyle`，绝不顺手写 `beadSize`）；② 不切相位、不推计时、不动棋局（L5）；
   * ③ 零分配热路径友好——面板点击非每帧，但仍走索引扫而不用 `find`/`map`（§2 纪律统一）。
   */
  private _cycleBeadStyle(): void {
    const styles = registeredStyles();
    let next = 0;
    for (let i = 0; i < styles.length; i++) {
      if (styles[i].id === this._v.beadStyle) {
        next = (i + 1) % styles.length;
        break;
      }
    }
    this._v.beadStyle = styles[next].id;
    this.persist();
  }

  /**
   * **行4 右格「豆子尺寸」循环**（EP11-S5 / S9 §2.2；档序 = `BEAD_SIZE_ORDER`，住 `tuning.ts`）。
   * 与 `_cycleBeadStyle` 同门：一次调用只写 `beadSize` 一个字段、`persist()` 恰 1 次、
   * 不切相位不推计时。生效面 = **仅网格珠珠体**（含已填态），托盘珠恒满幅不读本值（ux §3.3 ④）。
   */
  private _cycleBeadSize(): void {
    let next = 0;
    for (let i = 0; i < BEAD_SIZE_ORDER.length; i++) {
      if (BEAD_SIZE_ORDER[i] === this._v.beadSize) {
        next = (i + 1) % BEAD_SIZE_ORDER.length;
        break;
      }
    }
    this._v.beadSize = BEAD_SIZE_ORDER[next];
    this.persist();
  }

  /**
   * **行4「皮肤」循环**（EP12-S8 判例 = `_cycleBeadStyle` 同门）：
   * 循环序 = `registeredSkins()` 注册序；到达末档回绕；当前 id 不在注册表内
   * （理论不可达）⇒ 落 index 0。一次调用 `persist()` 恰 1 次、只写
   * `skinId` 一个字段、不切相位不推计时不动棋局（L5）。
   *
   * `[WXG-T-363]` **循环域 = 已拥有集合**（`ux-spec` v1.25 §3.8）：未买断肤不得被暂停面板
   * 免费切到（白嫖腿）。往后找到的第一枚已拥有 ⇒ 经 `wearSkin` 写档；**仅一枚已拥有**（= 当前档）
   * ⇒ `wearSkin` 走恒等分支 ⇒ 零写档零事件零换肤；宿主未注入拥有态 ⇒ 不设门（行为同改前）。
   */
  private _cycleSkin(): void {
    const skins = registeredSkins();
    const owns = this._host.ownsSkin;
    let cur = -1;
    for (let i = 0; i < skins.length; i++) {
      if (skins[i].id === this._v.skinId) {
        cur = i;
        break;
      }
    }
    for (let step = 1; step <= skins.length; step++) {
      const id = skins[(cur + step) % skins.length].id;
      if (owns && !owns(id)) continue;
      this.wearSkin(id);
      return;
    }
  }
}
