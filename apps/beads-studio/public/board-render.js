/**
 * beads-studio 前端盘面绘制 —— 与游戏实际版面同一视觉契约（WXG-T-179 续作）。
 *
 * 抽离原因：此前 index.html 内联画的是「色块方格」，和游戏里方珠+凹坑盘面完全
 * 两回事，预览一致 ≠ 版面一致。本模块把游戏正源的**可移植子集**搬到 canvas 2D：
 *
 *   正源（改游戏视觉先改这里再同步本文件，行号为 2026-09-21 快照）
 *   `games/beads/src/view/palette.ts`
 *     BEAD_PALETTE 10 色真源（L11-22）· BEAD_SHADOW_HEX/α（L155-156）
 *     CONTACT α 0.12（L162）· SOFT_HIGHLIGHT_ALPHAS [.08,.16,.3]（L170）
 *     BEVEL DARK −0.26 / LIGHT +0.2（L173-174）· RIM .38（L176）
 *     SOCKET_EDGE_DARK_MIX .3 / PIT_DARKEN .14（L230-232）· mix 语义（L90：−1黑/+1白线性）
 *     面板：background #ECEAF3 · slot #F7F6FB · slotBorder #D8D5E6 · locked #B9B4CC
 *   `games/beads/src/view/bead-render.ts`
 *     BEAD_CARD（radius .22 · shadowDy 3/64 · bevel 暗 5/64@2/64 亮 4/64@1.5/64
 *     · rim 2/64@1/64 · softHighlight 三层 [x.06,y.52,w.82,h.38,r.19]/[.1,.6,.72,.26,.13]
 *     /[.16,.68,.56,.14,.07]，y 自**底边**起算）· drawEmptySocket（pitInset .06、
 *     edgeWidth 3/64 min2，S3/S4 内缘光线未移植）· drawLockedBead（fill locked +
 *     背景色 α.9 十字、inset .16、线宽 2）
 *   `games/beads/src/config/tuning.ts`：BEAD_CELL 50 / BEAD_GAP 2 ⇒ 珠占格边 50/52
 *
 * **有意不移植**（预览不需要动效/无障碍层；要升级先立项）：L5 符号层（a11y 三重
 * 编码）、垫随 lift/scale 动效、选中环与呼吸、S3/S4 内缘光、托盘区。L11 目标色垫
 * **已移植**（view-model L792/L850：空格画目标色 socket、有珠画垫+内缩珠，正解/错位
 * 两视图同底）。
 *
 * 坐标系：设计空间 y 向上，canvas y 向下 —— 凡「自底边」的比例都已翻转，勿再乘错。
 */
(function (global) {
    'use strict';

    // ── 正源常量（同步表见文件头） ──
    var BEAD_PALETTE = [
        '#FDF6E9', '#FFD23F', '#F59B23', '#3FBF6B', '#E84C3D',
        '#8E6FD9', '#3D7BF5', '#A5652C', '#6B3E1E', '#33333D',
    ];
    var BG = '#ECEAF3', SLOT = '#F7F6FB', LOCKED = '#B9B4CC';
    var RADIUS = 0.22, CELL_OF_PITCH = 50 / 52;
    var SHADOW_DY = 3 / 64, SHADOW_A = 0.15, CONTACT_A = 0.12;
    var BEVEL_DARK_W = 5 / 64, BEVEL_DARK_IN = 2 / 64, BEVEL_DARK_MIX = -0.26;
    var BEVEL_LIGHT_W = 4 / 64, BEVEL_LIGHT_IN = 1.5 / 64, BEVEL_LIGHT_MIX = 0.2;
    var RIM_W = 2 / 64, RIM_IN = 1 / 64, RIM_MIX = 0.38;
    var SOFT = [
        { x: 0.06, y: 0.52, w: 0.82, h: 0.38, r: 0.19, a: 0.08 },
        { x: 0.10, y: 0.60, w: 0.72, h: 0.26, r: 0.13, a: 0.16 },
        { x: 0.16, y: 0.68, w: 0.56, h: 0.14, r: 0.07, a: 0.30 },
    ];
    var SOCKET_EDGE_MIX = -0.3, SOCKET_PIT_MIX = -0.44, SOCKET_PIT_INSET = 0.06, SOCKET_EDGE_W = 3 / 64;
    /** 珠体相对垫的四边内缩：BEAD_DRAW_INSET 6 / BEAD_CELL 50（tuning.ts，同心圆角式 radius = padR − inset）。 */
    var BEAD_INSET_RATIO = 6 / 50;

    // ── 纯逻辑（可单测） ──

    /** rowstring 字符 → 0-based 色号索引：'1'→0 … '9'→8，'A'→9（charset ".x1-9A"）。
     *  游戏正源 levels.ts 是 **1-based**（'1'→cc−48，'A'→10）；旧内联写 −55 把 'A'
     *  算成 10 ⇒ 炭黑珠一直吃 hsl 兑底（自检拓出的陈年 off-by-one，本模块已纠）。 */
    function indexFromChar(ch) {
        var c = ch.charCodeAt(0);
        return c >= 65 ? c - 56 : c - 49;
    }

    /** 网格布局：cell = 可容纳方格边（含 BEAD_GAP 比），珠边 = cell·50/52，整体居中。 */
    function layout(canvasW, canvasH, cols, rows) {
        var cell = Math.min(canvasW / cols, canvasH / rows);
        var size = cell * CELL_OF_PITCH;
        return { cell: cell, size: size, ox: (canvasW - cell * cols) / 2, oy: (canvasH - cell * rows) / 2 };
    }

    /** mix(hex, t)：−1→黑 / 0→原色 / +1→白，逐通道线性（= palette.ts mix 同语义）。 */
    function mix(hex, amount) {
        var n = parseInt(hex.slice(1), 16);
        var target = amount >= 0 ? 255 : 0, t = Math.abs(amount);
        var out = '#';
        for (var sh = 16; sh >= 0; sh -= 8) {
            var c = (n >> sh) & 255;
            out += ('0' + Math.round(c + (target - c) * t).toString(16)).slice(-2);
        }
        return out;
    }

    /** 珠面颜色：一律走 10 色游戏真源（所见 = 导入后游戏所画；raw 色板差异由 ⚠ 徽标声明）。 */
    function beadColor(index) {
        return BEAD_PALETTE[index] || BEAD_PALETTE[9];
    }

    // ── 绘制 ──

    function rr(g, x, y, w, h, r) {
        if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
        r = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }
    function ln(g, x1, y1, x2, y2, color, w) {
        g.strokeStyle = color; g.lineWidth = w;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }

    /** socket（S0 底色 + S2 坑底 + S1 暗缘框）。base = 目标色时为游戏同款「提示色坑」，缺省用中性 slot。 */
    function drawSocket(g, x, y, size, base) {
        base = base || SLOT;
        var r = Math.round(size * RADIUS);
        rr(g, x, y, size, size, r); g.fillStyle = base; g.fill();
        var inset = size * SOCKET_PIT_INSET;
        rr(g, x + inset, y + inset, size - inset * 2, size - inset * 2,
            Math.max(2, Math.round((size - inset * 2) * RADIUS * 0.8)));
        g.fillStyle = mix(base, SOCKET_PIT_MIX); g.fill();
        rr(g, x, y, size, size, r);
        g.strokeStyle = mix(base, SOCKET_EDGE_MIX);
        g.lineWidth = Math.max(2, size * SOCKET_EDGE_W); g.stroke();
    }

    function drawLocked(g, x, y, size) {
        rr(g, x, y, size, size, Math.round(size * RADIUS));
        g.fillStyle = LOCKED; g.fill();
        var inset = size * 0.16;
        ln(g, x + inset, y + inset, x + size - inset, y + size - inset, 'rgba(236,234,243,0.9)', 2);
        ln(g, x + size - inset, y + inset, x + inset, y + size - inset, 'rgba(236,234,243,0.9)', 2);
    }

    /** 珠子（L11 目标色垫可选 + L0a 接触阴影/L0b 投影/L1 主体/L2 暗倒角/L3 亮倒角/L3b rim/L4 三层软高光）。
     *  传 targetBase ⇒ 先画垫（fill = edge 色、满幅），珠体内缩露缝且圆角同心（WXG-T-162 问题 3 同式）。 */
    function drawBead(g, x, y, size, base, targetBase) {
        var r = Math.round(size * RADIUS);
        var inset = 0;
        if (targetBase) {
            rr(g, x, y, size, size, r); g.fillStyle = mix(targetBase, SOCKET_EDGE_MIX); g.fill();
            inset = size * BEAD_INSET_RATIO;
            x += inset; y += inset; size -= inset * 2;
            r = Math.max(1, r - inset);
        }
        rr(g, x + size * 0.06, y + size * 0.88, size * 0.88, size * 0.1, r * 0.5);
        g.fillStyle = 'rgba(30,32,51,' + CONTACT_A + ')'; g.fill();
        rr(g, x, y + size * SHADOW_DY, size, size, r);
        g.fillStyle = 'rgba(30,32,51,' + SHADOW_A + ')'; g.fill();
        rr(g, x, y, size, size, r); g.fillStyle = base; g.fill();
        var dark = mix(base, BEVEL_DARK_MIX), dIn = size * BEVEL_DARK_IN;
        ln(g, x + dIn, y + size - dIn, x + size - dIn, y + size - dIn, dark, Math.max(2, size * BEVEL_DARK_W));
        ln(g, x + size - dIn, y + size - dIn, x + size - dIn, y + dIn, dark, Math.max(2, size * BEVEL_DARK_W));
        var light = mix(base, BEVEL_LIGHT_MIX), lIn = size * BEVEL_LIGHT_IN;
        ln(g, x + lIn, y + lIn, x + size - lIn, y + lIn, light, Math.max(2, size * BEVEL_LIGHT_W));
        ln(g, x + lIn, y + lIn, x + lIn, y + size - lIn, light, Math.max(2, size * BEVEL_LIGHT_W));
        var rimIn = size * RIM_IN;
        ln(g, x + rimIn, y + rimIn, x + size - rimIn, y + rimIn, mix(base, RIM_MIX), Math.max(1, size * RIM_W));
        for (var i = 0; i < SOFT.length; i++) {
            var s = SOFT[i];
            rr(g, x + size * s.x, y + size * (1 - s.y - s.h), size * s.w, size * s.h, size * s.r);
            g.fillStyle = 'rgba(255,255,255,' + s.a + ')'; g.fill();
        }
    }

    /**
     * rowstring 数组（misplaced 或正解）→ 盘面。opts: { cols, rows, pattern }，
     * pattern = 正解 rowstrings（目标色，view-model L792/L850 同式：空格画目标色坑、
     * 有珠画垫+内缩珠；pattern 缺省退化为按 beads 自身色画满珠，无垫无坑）。
     * 字符契约（levels-spec §2）：'.' 空位 · 'x' 非盘 locked · '1'-'9','A' 珠色。
     */
    function drawBoard(g, canvasW, canvasH, rowsArr, opts) {
        var cols = opts.cols, rows = opts.rows, pat = Array.isArray(opts.pattern) ? opts.pattern : null;
        g.fillStyle = BG; g.fillRect(0, 0, canvasW, canvasH);
        if (!Array.isArray(rowsArr) && !pat) return;
        var L = layout(canvasW, canvasH, cols, rows);
        for (var y = 0; y < rows; y++) {
            var line = (rowsArr || [])[y] || '';
            var pLine = (pat || [])[y] || '';
            for (var x = 0; x < cols; x++) {
                var ch = line[x], tch = pLine[x];
                var bx = L.ox + x * L.cell + (L.cell - L.size) / 2;
                var by = L.oy + y * L.cell + (L.cell - L.size) / 2;
                var target = tch && tch !== '.' && tch !== 'x' ? beadColor(indexFromChar(tch)) : null;
                if (!ch || ch === '.') {
                    if (pat) { if (target) drawSocket(g, bx, by, L.size, target); }
                    else if (!pat) drawSocket(g, bx, by, L.size);
                } else if (ch === 'x') drawLocked(g, bx, by, L.size);
                else drawBead(g, bx, by, L.size, beadColor(indexFromChar(ch)), pat ? target : null);
            }
        }
    }

    var BeadsBoardRender = {
        drawBoard: drawBoard, drawBead: drawBead, drawSocket: drawSocket, drawLocked: drawLocked,
        layout: layout, indexFromChar: indexFromChar, mix: mix, beadColor: beadColor, BEAD_PALETTE: BEAD_PALETTE,
    };
    global.BeadsBoardRender = BeadsBoardRender;
})(typeof globalThis !== 'undefined' ? globalThis : this);
