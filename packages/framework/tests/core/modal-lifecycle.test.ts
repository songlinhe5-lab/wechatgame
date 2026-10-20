import { describe, expect, it } from 'vitest';
import { ModalLifecycle } from '../../src/core/ui/modal-lifecycle.js';

describe('ModalLifecycle', () => {
    it('starts closed at progress 0', () => {
        const modal = new ModalLifecycle();
        expect(modal.phase).toBe('closed');
        expect(modal.progress).toBe(0);
    });

    it('opens over the caller-supplied duration', () => {
        const modal = new ModalLifecycle();
        modal.open(200);
        expect(modal.phase).toBe('opening');
        modal.update(100);
        expect(modal.progress).toBeCloseTo(0.5);
        modal.update(100);
        expect(modal.phase).toBe('open');
        expect(modal.progress).toBe(1);
    });

    it('closes over the caller-supplied duration', () => {
        const modal = new ModalLifecycle();
        modal.open(0);
        modal.close(200);
        expect(modal.phase).toBe('closing');
        modal.update(100);
        expect(modal.progress).toBeCloseTo(0.5);
        modal.update(100);
        expect(modal.phase).toBe('closed');
        expect(modal.progress).toBe(0);
    });

    it('reverses mid-flight from the current progress without jumping', () => {
        const modal = new ModalLifecycle();
        modal.open(200);
        modal.update(100); // 0.5 opening
        modal.close(200);
        expect(modal.phase).toBe('closing');
        expect(modal.progress).toBeCloseTo(0.5);
        modal.update(50); // 0.25 closing
        modal.open(200);
        expect(modal.phase).toBe('opening');
        expect(modal.progress).toBeCloseTo(0.25);
    });

    it('completes immediately when duration is zero', () => {
        const modal = new ModalLifecycle();
        modal.open(0);
        expect(modal.phase).toBe('open');
        expect(modal.progress).toBe(1);
        modal.close(0);
        expect(modal.phase).toBe('closed');
        expect(modal.progress).toBe(0);
    });

    it('ignores same-direction re-entry so the duration is not reset', () => {
        const modal = new ModalLifecycle();
        modal.open(200);
        modal.update(100); // 0.5
        modal.open(2000);
        modal.update(100);
        expect(modal.phase).toBe('open');
        expect(modal.progress).toBe(1);
    });

    it('clamps overshoot and ignores non-positive dt', () => {
        const modal = new ModalLifecycle();
        modal.open(100);
        modal.update(-16);
        expect(modal.progress).toBe(0);
        modal.update(500);
        expect(modal.phase).toBe('open');
        expect(modal.progress).toBe(1);
    });

    it('reset() hard-hides mid-flight and allows reopening', () => {
        const modal = new ModalLifecycle();
        modal.open(200);
        modal.update(100);
        modal.close(200);
        modal.reset();
        expect(modal.phase).toBe('closed');
        expect(modal.progress).toBe(0);
        modal.open(200);
        expect(modal.phase).toBe('opening');
    });

    it('update() is a no-op while settled', () => {
        const modal = new ModalLifecycle();
        modal.update(16);
        expect(modal.phase).toBe('closed');
        expect(modal.progress).toBe(0);
        modal.open(0);
        modal.update(16);
        expect(modal.phase).toBe('open');
        expect(modal.progress).toBe(1);
    });
});
