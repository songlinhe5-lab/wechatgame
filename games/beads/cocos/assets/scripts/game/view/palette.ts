/**
 * Beads colour palette.
 *
 * Single source of truth for every colour the game draws. The bead palette
 * itself is owned by `games/beads/art/art-bible.md §3.2` (10 colours, each
 * bound to a symbol + lightness step — the triple encoding). Gameplay and the
 * view model only ever reference names/indices, never literals.
 */

/** The 10-colour bead palette, index 1..10 → array slot 0..9 (art-bible §3.2). */
export const BEAD_PALETTE: readonly string[] = Object.freeze([
  '#FDF6E9', // 1 奶白 ○ 亮
  '#FFD23F', // 2 柠黄 ★ 亮
  '#F59B23', // 3 活力橙 ● 中
  '#3FBF6B', // 4 草绿 ■ 中
  '#E84C3D', // 5 玫红 ♥ 中暗
  '#8E6FD9', // 6 丁香紫 ◐ 中暗
  '#3D7BF5', // 7 湖蓝 ▽ 暗
  '#A5652C', // 8 赭棕 ▲ 暗
  '#6B3E1E', // 9 深棕 ◆ 最暗
  '#33333D', // 10 炭黑 ✚ 最暗
]);

/** HEX for a 1-based palette index (out-of-range → charcoal fallback). */
export function beadColor(colorIdx: number): string {
  return BEAD_PALETTE[colorIdx - 1] ?? BEAD_PALETTE[9]!;
}

export interface BeadsPalette {
  /** Page background. */
  readonly background: string;
  /** Tray panel fill (panel_surface). */
  readonly panel: string;
  /** Panel stroke (panel_border, 1px)。 */
  readonly panelBorder: string;
  /** Empty-slot inner fill + border. */
  readonly slot: string;
  readonly slotBorder: string;
  /** Expansion-row dashed-slot stroke (slot_dashed)。 */
  readonly slotDashed: string;
  /** Locked-cell hatch colour (art-bible §3.4: #B9B4CC). */
  readonly locked: string;
  readonly text: string;
  readonly textDim: string;
  /** 中性强调 accent_primary（§3.5：主按钮底/结算角标/连击字；v1.3 F6 取代已删除的 textAccent）。 */
  readonly accentPrimary: string;
  /** 设置齿轮紫（§3.1 accent_purple，小面积图标专用，F7②）。 */
  readonly accentPurple: string;
  /** 成功绿（§3.1 success；⚠ 与珠色4 同值待冻结变更，§3.5 登记不改项）。 */
  readonly success: string;
  /** Timer danger colour (§3.5 urgent channel). */
  readonly danger: string;
  /** `hint` / 引导外描边蓝（art-bible §3.4 `accent_blue` #3D7BF5，非珠色）。 */
  readonly hintBlue: string;
  /** Ad-badge placeholder (ADR-0006: badge only, no wx API). */
  readonly adBadge: string;
  /** Banner backdrop plate. */
  readonly bannerBackdrop: string;
  readonly bannerText: string;
}

export const DEFAULT_PALETTE: BeadsPalette = {
  // v1.3 丙案「双色温对撞」冷底 UI token（真源 = art-bible §3.1 v1.3 表；F1 消漂移）。
  background: '#ECEAF3', // bg_base 冷紫灰（v1.2 暖米白 #F6F1E7 作废）
  panel: '#FFFFFF', // panel_surface
  panelBorder: '#E2DFF0', // panel_border 1px
  slot: '#F7F6FB', // slot_fill（v1.2 暖 #EDE7DA 作废）
  slotBorder: '#D8D5E6', // slot_border（v1.2 暖 #D8D0C0 作废）
  slotDashed: '#C9C5DA', // slot_dashed 扩展行虚线
  locked: '#B9B4CC',
  text: '#2A2E43', // text_primary 深藏青（v1.2 #33333D=珠色10 作废，避免与炭黑珠混）
  textDim: '#6E7288', // text_secondary：28px 白底标签 4.74:1 达标（F7④ a11y 假绿根治；v1.2 暖 #8B8578≈3.7:1 作废）
  // F6 路由（view-model 阶段落地）：textAccent（=珠色3 活力橙）已删除——按消费语义
  // 逐处分流到 accentPrimary（主按钮/角标/连击字，§3.5）/ hintBlue（选中点，环状 ≤8px）/
  // STAR_GOLD（结算星/缎带，资产色）等；暖橙自此仅存在于珠子本体。
  accentPrimary: '#2A2E43', // accent_primary（§3.5 中性强调）
  accentPurple: '#7C6FD9', // accent_purple 设置齿轮（F7②）
  success: '#3FBF6B', // success（⚠ 珠色4 同值待冻结变更，§3.5 登记不改项）
  danger: '#E8434A', // danger（对齐 art-bible §3.1；v1.2 #E84C3D=珠色5 作废，避免与玫红珠混）
  hintBlue: '#3D7BF5',
  adBadge: '#2A2E43', // ad_badge 深藏青（F6：v1.2 亮黄 #FFCB3D 抢焦点作废；白 ▶ 对比 13.4:1）
  bannerBackdrop: '#33333D',
  bannerText: '#FDF6E9',
};

/**
 * Blend a `#rrggbb` colour toward black or white.
 * @param amount -1 → black, 0 → unchanged, +1 → white.
 */
export function mix(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const blend = (c: number) => Math.round(c + (target - c) * t);
  return toHex(blend(r), blend(g), blend(b));
}

/** Apply an opacity to a hex colour by returning an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Linear interpolation between two HEX colours — the `mix(A, B, t)` of
 * `assets-spec.md` §0 (`t` is the weight of `B`: 0 → A, 1 → B).
 *
 * Distinct from {@link mix}, which only walks a single colour toward black/white.
 * Pass the *backdrop* as `A` to composite a translucent ink over it.
 */
export function mixWith(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  const lerp = (p: number, q: number) => Math.round(p + (q - p) * k);
  return toHex(lerp(x.r, y.r), lerp(x.g, y.g), lerp(x.b, y.b));
}

/**
 * Perceived brightness of a `#rrggbb` colour, 0..1 (Rec. 601 luma).
 *
 * This is the 「亮度」 of `assets-spec.md` §1.1 L5 — that rule is
 * `亮度 > 0.6 → 深色墨`, so this definition is pinned by that threshold (do not
 * swap it for {@link relativeLuminance} without re-deriving the symbol inks).
 */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** WCAG relative luminance (0..1) — the basis of {@link contrastRatio}. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21) between two **opaque** `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─────────────────────────── bead parameter card colours (assets-spec §1.1) ──
//
// These are the only `#rrggbb` literals the bead card needs. They live here (not
// in `view/bead-render.ts`) so that `view/` holds no colour literals at all
// (control-manifest §3 self-check: hex literals appear only in `palette.ts`).

/** L0b drop shadow (`#1E2033`). */
export const BEAD_SHADOW_HEX = '#1E2033';
export const BEAD_SHADOW_ALPHA = 0.15;
/** L0b shadow while `selected` (§1.2: α 0.15 → 0.25). */
export const BEAD_SHADOW_ALPHA_SELECTED = 0.25;
/**
 * L0a 接触阴影（v1.3 十层卡 · F4）：贴底窄条让珠「坐」在面上；墨色复用 {@link BEAD_SHADOW_HEX}。
 */
export const BEAD_CONTACT_SHADOW_ALPHA = 0.12;
/** L4 软高光墨色（`#FFFFFF`）——v1.3 三层 L4a/b/c 复用。 */
export const BEAD_HIGHLIGHT_HEX = '#FFFFFF';
/**
 * v1.3 十层卡以 L4a/b/c 三层递减 α 软高光取代硬边单高光条（F4）。
 * @deprecated 保留仅供 §1.2 empty/locked「无高光」断言与迁移期引用；bead-render 不再发射 α0.38 单条。
 */
export const BEAD_HIGHLIGHT_ALPHA = 0.38;
/** L4a/b/c 软高光三层不透明度（外扩递减、中心递增；累计中心 ≈0.48 / 边缘 ≈0.08）。 */
export const BEAD_SOFT_HIGHLIGHT_ALPHAS: readonly number[] = Object.freeze([0.08, 0.16, 0.3]);
/** L2 / L3 倒角混色（v1.3 加深/加亮：暗 −0.26、亮 +0.20；原 −0.22 / +0.18）。 */
export const BEAD_BEVEL_DARK_MIX = -0.26;
export const BEAD_BEVEL_LIGHT_MIX = 0.2;
/** L3b rim 光混色（v1.3 新增：上内缘单线 `mix(base,#FFF,0.38)`）。 */
export const BEAD_RIM_MIX = 0.38;

// ───────────── container plate + glow band / background layers (§1.7/§1.8，F2/F3/F8) ──
//
// v1.3 丙案三组叠层的墨色（几何/α 在 `config/tuning`）。仅 `palette.ts` 持 hex
//（control-manifest §3）；都走**叠层递减 α**，禁止实涂（§1.7/§1.8 头注）。

/** 暖光 band 墨色（glow_warm `#FFF3E2`，仅拼图容器外缘，§3.5 暖光纪律）。 */
export const GLOW_WARM_HEX = '#FFF3E2';
/** 背景冷沉层（bg_depth `#E3E0EE`，全屏 α0.04，仅冷色，F8）。 */
export const BG_DEPTH_HEX = '#E3E0EE';
/** 背景中心提亮（bg_lift `#F4F2FA`，与 bg_base ΔL ≤4%，F8）。 */
export const BG_LIFT_HEX = '#F4F2FA';
/** 结算星/缎带金（资产色判例：v1.3 §3.1 无金 token，按 `POWERUP_INK_STAR` 同判例固定；
 *  珠色2 柠黄同值但**语义不同源**——结算场景珠面不在场，无 §3.5 冲突）。 */
export const STAR_GOLD = '#FFD23F';

/**
 * G6 结算彩带 5 色子集（`assets-spec §1.6.6`；全部引用既有 token，**零新 hex**）。
 * 显式排除：珠色3 暖橙 `#F59B23`（§3.5「暖橙仅珠子本体」）、珠色2 柠黄（与
 * STAR_GOLD 同值——取 STAR_GOLD 语义）、珠色1 奶白（与 panel 近重）、珠色8/9/10 暗档（落白面板读作污渍）。
 * 消费方按 `idx mod 5` 取色（星形/圆点不参与，无编码职能，A5 装饰层）。 */
export const CONFETTI_COLORS: readonly string[] = Object.freeze([
  DEFAULT_PALETTE.panel, // panel_surface #FFFFFF
  STAR_GOLD, // #FFD23F（结算语义同源，非珠色2）
  BEAD_PALETTE[3]!, // 珠色4 草绿 #3FBF6B
  BEAD_PALETTE[4]!, // 珠色5 玫红 #E84C3D
  BEAD_PALETTE[5]!, // 珠色6 丁香紫 #8E6FD9
]);

// ─────────────────────────── empty-socket target-colour hint (assets-spec §1.2 E1/E4) ──
//
// Two §3.8 冻结常量（`systems-index.md` §3.8，WXG-T-080 裁定）——「同色入格」可玩性
// 的第一道视觉解锁：空槽显示目标色底 + 幽灵符号，使未填态即可读出该格要填的颜色。

/**
 * E1 目标色底混合权重（⛔ v1.22 作废，WXG-T-130/131：empty 改目标色**纯色直填**
 * 四层凹陷卡 ⇒ 本常量零消费方。死值保留 —— 清槽玩法复活时随 E4 幽灵符号一并恢复。
 * §3.8 作废条目（v1.22 冻结变更，WXG-T-130）。
 */
export const EMPTY_TINT_MIX = 0.42;
/**
 * E4 幽灵符号不透明度（⛔ v1.22 作废，WXG-T-130/131：幽灵符号移除——用户
 * 2026-09-16 裁定「暂时不需要支持色盲玩家」（可访问性降级，accessibility v1.5
 * 登记含可恢复路径）。死值保留 + 开关式恢复零成本。§3.8 作废条目。
 */
export const EMPTY_GHOST_ALPHA = 0.32;

// ───────────── 凹陷坑 / 珠垫 端点（v1.5 质感语言 · assets-spec §1.9，WXG-T-131/143）──
//
// 「纯色底 + 光影材质」的同色相端点推导（§1.9.2）：L+ 明端 / L− 暗端 / pit 坑底。
// 模块级**预烘焙**成查找表（§1.9.5）：`buildRenderModel` 每帧只查表，零字符串分配。

/** S1 暗缘框 / L11 垫墨色：`mix(底色, #000, 0.30)`（与珠卡 L2 暗端同族但独立冻结）。 */
export const SOCKET_EDGE_DARK_MIX = 0.3;
/** S2 坑底：同色相再暗一档（`−0.14`，§1.9.2「轻档」——深棕/炭黑读感由验收项钉住）。 */
export const SOCKET_PIT_DARKEN = 0.14;
/** S4 下内缘受光亮线：`mix(底色, #FFF, 0.38)`（复用珠卡 rim 端点 §1.9.2）。 */
export const SOCKET_LIT_MIX = 0.38;

/**
 * 十色端点查找表（预烘焙，§1.9.5）：索引 0..9 ↔ 珠色 1..10。
 * 每项 `{ base, edge, pit, lit }` —— `buildRenderModel` 热路径只查表不 mix。
 */
export interface BeadEndpoints {
  readonly base: string;
  /** S1 暗缘框 / L11 垫：`mix(base, #000, 0.30)`。 */
  readonly edge: string;
  /** S2 坑底：`mix(base, #000, 0.30 + 0.14)`（坑底在暗缘之内再暗一档）。 */
  readonly pit: string;
  /** S4 受光亮线：`mix(base, #FFF, 0.38)`。 */
  readonly lit: string;
}

/** 模块级预烘焙（§1.9.5）：构建期 30 次 mix，热路径零分配。 */
export const BEAD_ENDPOINTS: readonly BeadEndpoints[] = BEAD_PALETTE.map((base) => ({
  base,
  edge: mix(base, -SOCKET_EDGE_DARK_MIX),
  pit: mix(base, -(SOCKET_EDGE_DARK_MIX + SOCKET_PIT_DARKEN)),
  lit: mix(base, SOCKET_LIT_MIX),
}));

/** 按珠色索引取端点（越界 → 炭黑兜底，同 {@link beadColor}）。 */
export function beadEndpoints(colorIdx: number): BeadEndpoints {
  return BEAD_ENDPOINTS[colorIdx - 1] ?? BEAD_ENDPOINTS[9]!;
}

// ──────────────────────────────────────────────── symbol ink (assets-spec L5) ──
/** Ink used on a bright bead: `mix(base, #000, 0.55)` → the mix amount. */
export const SYMBOL_INK_DARK_MIX = -0.55;
/** Ink used on a dark bead: `#FFFFFF @ 0.90`. */
export const SYMBOL_INK_LIGHT = '#FFFFFF';
export const SYMBOL_INK_LIGHT_ALPHA = 0.9;
/** §1.1 L5 threshold on {@link luminance}: above it, ink goes dark. */
export const SYMBOL_INK_LUMA_THRESHOLD = 0.6;
/**
 * Hard floor from `accessibility.md` B2 (「符号对珠面 ≥ 3:1」). Binding where it
 * disagrees with the L5 threshold — see `symbolInk()` for the one colour affected.
 */
export const SYMBOL_CONTRAST_MIN = 3;

// ───────────────────────────────────── powerup icon inks (assets-spec §1.4)
/**
 * The three powerup glyphs carry **fixed** inks in §1.4 — they are assets, not
 * theme tokens, so they are not read off `BeadsPalette`. They live in this file
 * because `view/palette.ts` is the only `view/` module allowed to hold hex
 * literals (control-manifest §3 self-check).
 */
/** 魔法棒 stick (`item_area_clear`). */
export const POWERUP_INK_WAND = '#8E6FD9';
/** 星 / 刷毛 (`item_area_clear` star, `item_tray_clear` bristles). */
export const POWERUP_INK_STAR = '#FFD23F';
/** 扫帚柄 (`item_tray_clear`). */
export const POWERUP_INK_STRAW = '#A5652C';
/** 磁铁本体 (`item_random_clear`). */
export const POWERUP_INK_MAGNET = '#E84C3D';
/** 磁极端帽 (`item_random_clear`, §1.4「白/浅蓝端帽」). */
export const POWERUP_INK_CAP = '#D8D5E6';
/** 角标 `ad_badge` 里的白色 ▶（§1.4「白色 ▶（边 10px）」）。 */
export const POWERUP_BADGE_GLYPH = '#FFFFFF';
/** 卡片投影 α（§1.4「投影 α0.10」）——墨色复用 {@link BEAD_SHADOW_HEX}。 */
export const POWERUP_SHADOW_ALPHA = 0.1;

// ─────────────────────────────── btn_expand 资产色（`assets-spec §1.3`）
/**
 * 与道具图标同判例：§1.3 写定的固定色属于**资产参数**而非主题 token，
 * 不进 `BeadsPalette`（本文件是 `view/` 下唯一允许持有 hex 字面量的模块）。
 */
/** `btn_expand` 胶囊底（§1.3：`#2A2E43`）。 */
export const EXPAND_BTN_INK = '#2A2E43';
/** `btn_expand` 的 ▶ 与「扩展」白字（§1.3：白）。 */
export const EXPAND_BTN_TEXT = '#FFFFFF';

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
