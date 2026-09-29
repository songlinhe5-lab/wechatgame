import { pathToFileURL } from 'node:url';
const DIST = new URL('../../dev/harness/dist/', import.meta.url).pathname;
const MAP = { '@wxgame/framework': DIST + 'packages/framework/src/index.js' };
export function resolve(spec, ctx, next) {
  if (MAP[spec]) return { url: pathToFileURL(MAP[spec]).href, shortCircuit: true };
  return next(spec, ctx);
}
