/**
 * Bomb-brick explosions.
 *
 * A bomb brick (`B`) deals area damage to its neighbours when it shatters, and
 * a neighbour that also shatters as a result **chains**. See
 * `design/gdd/bricks.md §2.6` and `design/gdd/systems-index.md §3.3`.
 *
 * THREE RULES THAT MATTER (all are hard QA criteria):
 *
 * 1. **Integer square distance.** The blast test is `dx² + dy² <= radius²`,
 *    never `Math.hypot(...) <= radius`. The radius (68) is *exactly* the
 *    horizontal column pitch (62 + 6), so the boundary case `d = 68` decides
 *    whether the hit shape is a 5-cell cross or a 3-cell T. Floating point
 *    comparison on that boundary is not worth the risk, and `<=` (not `<`) is
 *    what makes the orthogonal neighbours count.
 * 2. **Steel is immune.** `S` bricks take no damage from a blast. The ball still
 *    bounces off them; only the explosion ignores them.
 * 3. **Depth-limited chain.** A cascade runs at most `maxChain` generations, so
 *    two adjacent bombs cannot loop forever.
 */

import type { BrickLike } from './physics.js';

/** A brick that carries its level-data code — required to detect chain sources. */
export interface ExplodableBrick extends BrickLike {
  /** The `brickTypes` code this brick was compiled from (e.g. `'B'`). */
  readonly type: string;
}

export interface ExplosionOptions {
  /** Blast radius in design px, measured between brick *centres*. */
  readonly radius: number;
  /** HP removed from each brick inside the blast. */
  readonly damage: number;
  /** Maximum chain generations (the seed counts as generation 0). */
  readonly maxChain: number;
  /**
   * Brick codes that continue the chain when destroyed by a blast.
   * Defaults to `['B']`.
   */
  readonly chainCodes?: readonly string[];
}

/** Accumulated outcome of one cascade. `damaged`/`destroyed` are reused. */
export interface ExplosionResult {
  /** Bricks that lost HP to the blast, in the order they were hit. */
  readonly damaged: ExplodableBrick[];
  /** Bricks whose HP reached 0, in the order they were destroyed. */
  readonly destroyed: ExplodableBrick[];
  /** Generations actually executed (0 when nothing was in range). */
  chainDepth: number;
}

export function createExplosionResult(): ExplosionResult {
  return { damaged: [], destroyed: [], chainDepth: 0 };
}

export function resetExplosionResult(result: ExplosionResult): void {
  result.damaged.length = 0;
  result.destroyed.length = 0;
  result.chainDepth = 0;
}

/**
 * Is `(bx, by)` inside a blast centred on `(ax, ay)`?
 *
 * Uses integer arithmetic on purpose — see rule 1 in the file header. `<=` is
 * load-bearing: at `d² === radius²` the brick **is** hit.
 */
export function withinBlast(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy <= radius * radius;
}

/** Squared centre distance — exposed so tests can assert the boundary exactly. */
export function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/**
 * Resolve the cascade triggered by `seed` shattering.
 *
 * The caller is responsible for having already destroyed `seed` itself (the ball
 * did that). This function only applies the *blast*.
 *
 * Each brick takes blast damage **at most once per cascade**, which keeps the
 * outcome deterministic and independent of brick iteration order.
 *
 * @param seed    the brick that just shattered
 * @param bricks  the live brick array
 * @param options radius / damage / chain limit
 * @param result  scratch object to fill (reused between calls)
 */
export function resolveExplosion(
  seed: ExplodableBrick,
  bricks: readonly ExplodableBrick[],
  options: ExplosionOptions,
  result: ExplosionResult,
): ExplosionResult {
  resetExplosionResult(result);

  const { radius, damage, maxChain } = options;
  if (radius <= 0 || damage <= 0 || maxChain <= 0) return result;

  const chainCodes = new Set(options.chainCodes ?? ['B']);
  const alreadyHit = new Set<ExplodableBrick>();

  let frontier: ExplodableBrick[] = [seed];

  for (let depth = 0; depth < maxChain && frontier.length > 0; depth++) {
    const nextFrontier: ExplodableBrick[] = [];
    result.chainDepth = depth + 1;

    for (const source of frontier) {
      for (const brick of bricks) {
        // The seed already shattered (the ball did that) — it must never be
        // damaged by its own blast, including when the cascade loops back to it.
        if (brick === seed) continue;
        if (brick === source) continue;
        if (brick.destroyed) continue;
        // Rule 2: steel must not be damaged — it never becomes a chain source.
        if (brick.indestructible) continue;
        if (alreadyHit.has(brick)) continue;
        if (!withinBlast(source.x, source.y, brick.x, brick.y, radius)) continue;

        alreadyHit.add(brick);
        brick.hp -= damage;
        result.damaged.push(brick);

        if (brick.hp <= 0) {
          brick.hp = 0;
          brick.destroyed = true;
          result.destroyed.push(brick);
          // Rule 3: only chain-capable codes propagate, and the depth loop caps it.
          if (chainCodes.has(brick.type)) nextFrontier.push(brick);
        }
      }
    }

    frontier = nextFrontier;
  }

  return result;
}

/**
 * Total damage a single cascade will deal — handy for balancing tests.
 * Counts every brick the blast can reach, ignoring HP.
 */
export function blastReach(
  seed: ExplodableBrick,
  bricks: readonly ExplodableBrick[],
  radius: number,
): ExplodableBrick[] {
  return bricks.filter(
    (b) =>
      b !== seed &&
      !b.destroyed &&
      !b.indestructible &&
      withinBlast(seed.x, seed.y, b.x, b.y, radius),
  );
}
