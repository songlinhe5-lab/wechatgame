/**
 * render-model-svg.mjs — serialise a framework `RenderModel` to SVG.
 *
 * The engine's render model is a flat list of draw commands in *design space*
 * (y-up, origin bottom-left). Canvas2D and Cocos are the production consumers;
 * this is a third one, used to export real frames as images for review.
 *
 * Design space is y-up; SVG is y-down. One `translate(0, H) scale(1, -1)` group
 * flips the whole frame, and text nodes get a local counter-flip so glyphs are
 * not mirrored.
 */

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
const num = (value) => (Number.isFinite(value) ? Number(Number(value).toFixed(2)) : 0);

/** Split a CSS `font` shorthand into SVG `font-size` / `font-family`. */
function parseFont(shorthand) {
  const match = /(\d+(?:\.\d+)?)px\s+(.+)/.exec(shorthand ?? '');
  return { size: match ? Number(match[1]) : 24, family: match ? match[2].trim() : 'sans-serif' };
}

const ANCHOR = { left: 'start', center: 'middle', right: 'end' };
const BASELINE = { top: 'hanging', middle: 'central', bottom: 'alphabetic' };

/**
 * @param {import('../../packages/framework/src/core/render/render-model.js').RenderModel} model
 * @returns {string} a standalone SVG document
 */
export function modelToSvg(model) {
  const w = model.designWidth;
  const h = model.designHeight;
  const parts = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ` +
      `font-family="ui-sans-serif, system-ui, -apple-system, 'PingFang SC', sans-serif">`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="${esc(model.background ?? '#0c0b1e')}"/>`);
  parts.push(`<g transform="translate(0 ${h}) scale(1 -1)">`);

  for (const cmd of model.commands) {
    const alpha = cmd.alpha ?? 1;
    const opacity = alpha < 1 ? ` opacity="${num(alpha)}"` : '';

    switch (cmd.kind) {
      case 'rect': {
        const rx = cmd.radius && cmd.radius > 0
          ? ` rx="${num(Math.min(cmd.radius, cmd.w / 2, cmd.h / 2))}"`
          : '';
        parts.push(
          `<rect x="${num(cmd.x)}" y="${num(cmd.y)}" width="${num(cmd.w)}" height="${num(cmd.h)}"${rx}` +
            ` fill="${esc(cmd.fill ?? 'none')}"` +
            (cmd.stroke ? ` stroke="${esc(cmd.stroke)}" stroke-width="${num(cmd.lineWidth ?? 1)}"` : '') +
            `${opacity}/>`,
        );
        break;
      }
      case 'circle': {
        parts.push(
          `<circle cx="${num(cmd.x)}" cy="${num(cmd.y)}" r="${num(cmd.r)}"` +
            ` fill="${esc(cmd.fill ?? 'none')}"` +
            (cmd.stroke ? ` stroke="${esc(cmd.stroke)}" stroke-width="${num(cmd.lineWidth ?? 1)}"` : '') +
            `${opacity}/>`,
        );
        break;
      }
      case 'line': {
        parts.push(
          `<line x1="${num(cmd.x1)}" y1="${num(cmd.y1)}" x2="${num(cmd.x2)}" y2="${num(cmd.y2)}"` +
            ` stroke="${esc(cmd.stroke)}" stroke-width="${num(cmd.lineWidth)}" stroke-linecap="round"${opacity}/>`,
        );
        break;
      }
      case 'polygon': {
        const pts = cmd.points;
        if (pts.length < 6) break;
        const list = [];
        for (let i = 0; i + 1 < pts.length; i += 2) list.push(`${num(pts[i])},${num(pts[i + 1])}`);
        parts.push(
          `<polygon points="${list.join(' ')}" fill="${esc(cmd.fill ?? 'none')}"` +
            (cmd.stroke ? ` stroke="${esc(cmd.stroke)}" stroke-width="${num(cmd.lineWidth ?? 1)}"` : '') +
            `${opacity}/>`,
        );
        break;
      }
      case 'text': {
        const font = parseFont(cmd.font);
        parts.push(
          // Counter-flip so glyphs read the right way up inside the y-flipped group.
          `<g transform="translate(${num(cmd.x)} ${num(cmd.y)}) scale(1 -1)">` +
            `<text x="0" y="0" fill="${esc(cmd.fill ?? '#ffffff')}" font-size="${num(font.size)}" ` +
            `font-family="${esc(font.family)}" text-anchor="${ANCHOR[cmd.align ?? 'left'] ?? 'start'}" ` +
            `dominant-baseline="${BASELINE[cmd.baseline ?? 'middle'] ?? 'central'}"${opacity}>` +
            `${esc(cmd.text)}</text></g>`,
        );
        break;
      }
      default:
        break;
    }
  }

  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}
