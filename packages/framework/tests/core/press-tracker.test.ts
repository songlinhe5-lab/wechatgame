import { describe, expect, it } from 'vitest';
import { PressTracker } from '../../src/core/ui/press-tracker.js';

describe('PressTracker', () => {
    it('commits when the release lands on the pressed target', () => {
        const gate = new PressTracker<string>();
        gate.begin('gear');
        expect(gate.pressed).toBe('gear');
        expect(gate.end('gear')).toBe('gear');
        expect(gate.pressed).toBeNull();
    });

    it('cancels when the release lands elsewhere or outside', () => {
        const gate = new PressTracker<string>();
        gate.begin('gear');
        expect(gate.end('zoom')).toBeNull();
        gate.begin('gear');
        expect(gate.end(null)).toBeNull();
    });

    it('cancel() drops the press with no commit', () => {
        const gate = new PressTracker<string>();
        gate.begin('gear');
        gate.cancel();
        expect(gate.pressed).toBeNull();
        expect(gate.end('gear')).toBeNull();
    });

    it('end() without begin() never commits', () => {
        const gate = new PressTracker<string>();
        expect(gate.end('gear')).toBeNull();
    });

    it('treats same-frame begin + end as an instant tap', () => {
        const gate = new PressTracker<string>();
        gate.begin('pause');
        expect(gate.end('pause')).toBe('pause');
    });

    it('a new begin() replaces the previous uncommitted target', () => {
        const gate = new PressTracker<string>();
        gate.begin('a');
        gate.begin('b');
        expect(gate.end('a')).toBeNull();
        gate.begin('b');
        expect(gate.end('b')).toBe('b');
    });
});
