/**
 * UI-60 · **容器 / 段命令流结构机检**（引擎无关、纯函数）
 * 正本 = `docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md` **DEC-8①**。
 *
 * 这条门校验的是「视图实际吐出的命令流是否良构」，与内核 `UiScopeTree`（管 enter/exit
 * **排序行为**）互补、不重复。内核按出现序定容器兄弟、按枚举序定段兄弟；但要让真机层序
 * 「不错乱」，前提是视图发出来的容器**各自是一段连续命令块**——否则 Cocos 把指令流压成写死
 * 五段通道后，跨通道的相对序会丢（本 ADR 的缺陷根因）。本函数把这条前提变成可回归的机检。
 *
 * 保证（视图一旦发容器命令 ⇒ 本函数即真机层序「不错乱」的 Node 侧替身）：
 *  1. 每个 `beginContainer` 有配对 `endContainer`；容器**不重叠/不嵌套**——新容器不得在上一个
 *     未闭合时打开（DEC-1 容器平铺为兄弟、按栈序叠放；DEC-9② 合并容器时也应写成相邻块而非套娃，
 *     内核 `_ownScope` 把每容器父节点固定为 `root`，嵌套本就会被拉平成同级 ⇒ 视图不该依赖它）。
 *     ⇒ 每容器 = 一段连续块 ⇒ **「容器 A 全部命令索引 < 容器 B」成立**（DEC-8① 第一句）。
 *  2. `segment` 只出现在容器内，且与 `segmentEnd` 配对、**段不叠套**（DEC-2 段在容器内不叠套）。
 *  3. `endContainer` / `endSegment` 不得悬空（无对应进入）。
 *  4. `clip` **不得出现在容器内**（`[WXG-T-439]` 显式降级）：Cocos 端的裁切走**全局** `clipHost`
 *     （`bindings.ts` 手搭的一套 `Mask` 子树，只在默认层），容器内发 `clip` 会被画到容器**之外**
 *     ⇒ 与容器层语义冲突。当前全仓仅 `view/meta-menu.ts` 的走马灯在**页面层**裁切（1 处），
 *     容器内零使用 ⇒ 这条门把「未来有人在容器内裁切」从静默画错变成当场红，而不是先给每个
 *     作用域投机建一套 Mask（零需求驱动）。真要放开时先做作用域级 clipHost 再拆本门。
 *
 * ⛔ 本函数只判**结构**；「遮罩压住面板与文字」的段间叠序由 `UiScopeTree` 内核 + 真机读数
 * （ADR-0033 P3 / DEC-8②）负责——那条腿的真伪只能由设备证，不在本 Node 门内。
 *
 * 返回违规描述列表（空 = 通过）。调用方按场景决定是 `throw`（CI 硬门）还是收集上报。
 */

import type { DrawCommand } from './render-model';

/**
 * 校验一帧命令流的容器 / 段结构良构性。单次线性扫描，非热路径（帧渲染不逐帧调它，
 * 由测试与 CI 在采样帧上跑）；输入为 `RenderModelBuilder.end()` 产出的 `RenderModel.commands`。
 */
export function checkUiContainerOrder(commands: readonly DrawCommand[]): string[] {
  const errors: string[] = [];
  // 当前打开态（容器嵌套被禁止 ⇒ 各用一个标量记录即可，无需栈）
  let openContainer: string | null = null;
  let openSegment: string | null = null;

  for (let i = 0; i < commands.length; i += 1) {
    const cmd = commands[i]!;
    switch (cmd.kind) {
      case 'container':
        if (openContainer !== null) {
          errors.push(`容器 "${cmd.id}" 在容器 "${openContainer}" 未闭合时打开（容器不得重叠/嵌套）@${i}`);
        }
        if (openSegment !== null) {
          errors.push(`容器 "${cmd.id}" 在段 "${openSegment}" 未闭合时打开 @${i}`);
        }
        openContainer = cmd.id;
        openSegment = null;
        break;
      case 'containerEnd':
        if (openContainer === null) {
          errors.push(`endContainer 无配对的 beginContainer @${i}`);
        } else if (openSegment !== null) {
          errors.push(`容器 "${openContainer}" 在段 "${openSegment}" 未闭合时结束 @${i}`);
          openSegment = null;
        }
        openContainer = null;
        break;
      case 'segment':
        if (openContainer === null) {
          errors.push(`beginSegment("${cmd.segment}") 出现在任何容器之外 @${i}`);
        }
        if (openSegment !== null) {
          errors.push(`段 "${openSegment}" 未闭合时开新段 "${cmd.segment}"（段不叠套）@${i}`);
        }
        openSegment = cmd.segment;
        break;
      case 'segmentEnd':
        if (openSegment === null) {
          errors.push(`endSegment 无配对的 beginSegment @${i}`);
        } else {
          openSegment = null;
        }
        break;
      case 'clip':
        if (openContainer !== null) {
          errors.push(
            `clip 出现在容器 "${openContainer}" 内 @${i}（Cocos 端 clip 走全局 clipHost，容器内裁切会画到容器之外 ⇒ 禁；见 ADR-0033 / WXG-T-439）`,
          );
        }
        break;
      default:
        break; // 绘制命令（rect/text/…）在结构校验里透传
    }
  }

  if (openContainer !== null) {
    errors.push(`容器 "${openContainer}" 到帧尾仍未闭合`);
  }
  if (openSegment !== null) {
    errors.push(`段 "${openSegment}" 到帧尾仍未闭合`);
  }
  return errors;
}
