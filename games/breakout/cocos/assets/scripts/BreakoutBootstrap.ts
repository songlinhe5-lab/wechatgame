/**
 * Breakout 的 Cocos 入口（方案 C 物理拷贝基线，缺口 G1）。
 *
 * 这是整个 Cocos 工程里唯一"懂游戏"的文件：把 BreakoutGame 交给框架的
 * Bootstrap，其余一切（节点树 / 渲染 / 输入 / 循环）由框架在运行时构建
 * （ADR-0003：空场景 + 代码驱动）。
 *
 * 导入指向 `assets/scripts/` 内的**拷贝件**（由
 * `pnpm run framework:sync` 从 packages/framework/src 与 games/breakout/src
 * 生成，禁止手改拷贝件）。相对导入带 `.js` 后缀，与拷贝件源码风格一致；
 * 已实测 TS 5.6 + moduleResolution "node" 可解析。
 */

import { _decorator } from 'cc';

import { Bootstrap } from './framework/adapters/cocos/bindings.js';
import type { Game } from './framework/core/game/game.js';
import { createBreakoutGame } from './game/index.js';

const { ccclass } = _decorator;

@ccclass('BreakoutBootstrap')
export class BreakoutBootstrap extends Bootstrap {
  protected createGame(): Game {
    return createBreakoutGame();
  }
}
