/**
 * levels.schema.ts —— 打砖块关卡数据结构定义（供程基岩直接落码）
 *
 * 用途：消费 `levels-01-05.json` 的类型安全接口。
 * 约定：本文件为**纯类型 + 常量**，不含运行时代码，可被 src 直接 import（type-only）。
 * 注意：坐标原点为画布左下角，y 轴向上（Cocos 约定）。
 */

/** 砖块类型代码 */
export type BrickTypeCode = 'N' | 'T' | 'S' | 'B' | 'G';

/** 道具 ID */
export type PowerupId = 'expand' | 'multi' | 'life' | 'slow' | 'sticky' | 'laser';

/** 清关条件 */
export type ClearCondition = 'all-destructible';

/** 适配模式 */
export type FitMode = 'FIXED_WIDTH' | 'FIXED_HEIGHT' | 'SHOW_ALL';

/** 画布设计分辨率 */
export interface DesignResolution {
  width: number;
  height: number;
  fitMode: FitMode;
}

/** 砖块网格（决定布局像素坐标） */
export interface GridDef {
  /** 列数 */
  cols: number;
  /** 砖块宽（px） */
  brickW: number;
  /** 砖块高（px） */
  brickH: number;
  /** 列间距（px） */
  gapX: number;
  /** 行间距（px） */
  gapY: number;
  /** 第 0 列砖块左边缘 x（px） */
  originX: number;
  /** 第 0 行砖块上边缘 y（px） */
  topY: number;
  /** 行间距 = brickH + gapY（px） */
  rowPitch: number;
}

/** 炸弹砖爆炸参数 */
export interface ExplodeDef {
  /** 爆炸半径（px），按砖块中心距离判定 */
  radius: number;
  /** 对范围内其他砖块造成的伤害（HP） */
  damage: number;
  /** 连锁递归深度上限 */
  maxChain: number;
}

/** 砖块类型定义 */
export interface BrickTypeDef {
  code: BrickTypeCode;
  /** 中文名 */
  name: string;
  /** 生命值；null 表示不可破坏（无限 HP）。炸弹每砖扣 1 点 HP，硬砖需被波及 2 次 */
  hp: number | null;
  /** 破碎时的基础得分（未乘连击倍率）；S 钢砖恒为 0（命中不计分、不计连击） */
  score: number;
  /**
   * 是否不可破坏（S 钢砖）。
   * 语义：免疫炸弹/激光等一切道具影响、**不计入通关条件**、
   * 命中仅派发 ball:hitBrick（永不派发 brick:destroyed）。
   */
  indestructible: boolean;
  /** 命中后是否有"受损态"视觉（硬砖用：亮度−30% + 裂纹加深） */
  damagedVisual?: boolean;
  /** 炸弹砖专用：爆炸波及同场其他砖块（**不伤钢砖、不伤玩家**），可递归连锁 */
  explode?: ExplodeDef;
  /** 掉落率倍率（金砖 ×3，即 rate = powerupDropRate × 3，封顶 1.0）。**非必掉** */
  dropRateMultiplier?: number;
}

/** 道具定义 */
export interface PowerupDef {
  id: PowerupId;
  /** 中文名 */
  name: string;
  /** 掉落随机权重（相对值） */
  weight: number;
  /** 持续时间（ms）；0 表示瞬时生效 */
  durationMs: number;
  /** 效果参数（各道具不同，见下方注释） */
  params: Record<string, number>;
  /*
   * params 语义：
   *  expand : { paddleWidthMultiplier: number }
   *  multi  : { splitCount: number, splitAngleDeg: number, maxBalls: number }
   *  life   : { maxLives: number, overflowScore: number }
   *  slow   : { speedMultiplier: number, minSpeed: number }
   *  sticky : {}
   *  laser  : { cooldownMs: number }
   */
}

/** 单关定义 */
export interface LevelDef {
  /** 关卡序号，从 1 开始，连续 */
  id: number;
  /** 关卡名（显示于过关/关卡选择） */
  name: string;
  /** 本关基础球速（px/s） */
  ballSpeed: number;
  /** 本关挡板宽度（px） */
  paddleWidth: number;
  /** 砖块破碎掉落道具的基础概率 0~1 */
  powerupDropRate: number;
  /** 进入本关时的初始生命；仅第 1 关需要，其余关卡继承当前生命 */
  livesOnEnter?: number;
  /** 清关条件 */
  clearCondition: ClearCondition;
  /** 本关允许掉落的道具白名单（引用顶层 powerupPool 的 key） */
  powerupPool: PowerupId[];
  /** 新手引导提示文案（仅第 1 关） */
  hint?: string;
  /**
   * 布局：行序从**上到下**，每行长度必须 === grid.cols。
   * **字符集固定为 `.NTSBG`**：'.' 表示空位；N/T/S/B/G 为砖型（取自 brickTypes 的 key）。
   * 出现集合外字符即视为错误。
   */
  rows: string[];
}

/** 关卡数据文件根结构 */
export interface LevelsFile {
  version: number;
  gameId: string;
  description?: string;
  designResolution: DesignResolution;
  /** 全局网格（所有关卡共用；如需单关覆盖应扩展，不在 v1 支持） */
  grid: GridDef;
  /** 砖块类型目录（单一数据源） */
  brickTypes: Record<BrickTypeCode, BrickTypeDef>;
  /** 道具目录（单一数据源） */
  powerupPool: Record<PowerupId, PowerupDef>;
  /** 关卡列表 */
  levels: LevelDef[];
}

/* ───────────────────────── 派生工具（供实现参考，非必须） ───────────────────────── */

/** 第 j 列砖块中心 x */
export const colCenterX = (grid: GridDef, j: number): number =>
  grid.originX + grid.brickW / 2 + j * (grid.brickW + grid.gapX);

/** 第 i 行砖块中心 y */
export const rowCenterY = (grid: GridDef, i: number): number =>
  grid.topY - grid.brickH / 2 - i * grid.rowPitch;

/** 关卡 rows 允许的字符集：'.'=空位，其余为砖型 code */
export const LEVEL_CHARSET = '.NTSBG';

/** 校验单关布局合法性（开发期断言） */
export function validateLevel(level: LevelDef, grid: GridDef): string[] {
  const errors: string[] = [];
  if (level.rows.length === 0) errors.push(`L${level.id}: rows 为空`);
  level.rows.forEach((row, i) => {
    if (row.length !== grid.cols) {
      errors.push(`L${level.id} row${i}: 长度 ${row.length} !== cols ${grid.cols}`);
    }
    for (const ch of row) {
      if (!LEVEL_CHARSET.includes(ch)) {
        errors.push(`L${level.id} row${i}: 非法字符 '${ch}'（仅允许 ${LEVEL_CHARSET}）`);
      }
    }
  });
  return errors;
}
