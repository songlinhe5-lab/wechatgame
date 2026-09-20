/**
 * Breakout 的 Cocos 入口（方案 C 物理拷贝基线，缺口 G1）。
 *
 * 这是整个 Cocos 工程里唯一"懂游戏"的文件：把 BreakoutGame 交给框架的
 * Bootstrap，其余一切（节点树 / 渲染 / 输入 / 循环）由框架在运行时构建
 * （ADR-0003：空场景 + 代码驱动）。
 *
 * 导入指向 `assets/scripts/` 内的**拷贝件**（由
 * `pnpm run framework:sync` 从 packages/framework/src 与 games/breakout/src
 * 生成，禁止手改拷贝件）。相对导入**无 `.js` 后缀**——实测 Cocos 3.8.8
 * 执行期模块加载器不解析 `.js` 后缀（编译期 tsc 可解析，两回事），
 * 拷贝件统一由 `framework:sync`（默认 strip-suffix 语义）生成。
 */

import { _decorator } from 'cc';

import { Bootstrap } from './framework/adapters/cocos/bindings';
import type { Game } from './framework/core/game/game';
import { createBreakoutGame } from './game/index';

const { ccclass } = _decorator;

@ccclass('BreakoutBootstrap')
export class BreakoutBootstrap extends Bootstrap {
  protected createGame(): Game {
    return createBreakoutGame();
  }
}
