import { describe, it } from 'vitest';
import { validateSwaps } from '../src/game/misplaced-assembler.js';
const P = ['123123', '123123', '123123', '123123', '123123'];
describe('bis3', () => {
  it('a', () => { console.log('A start'); validateSwaps('L1', P, [[9, 9, 0, 0]]); console.log('A end'); });
  it('b', () => { console.log('B start'); validateSwaps('L1', P, [[0, 0, 0]]); console.log('B end'); });
  it('c', () => { console.log('C start'); validateSwaps('L1', P, [[0, 0, 0, 'x']]); console.log('C end'); });
});
