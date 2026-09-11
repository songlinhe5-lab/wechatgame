import { describe, expect, it } from 'vitest';
import { StateMachine } from '../../src/core/fsm/state-machine.js';

type Phase = 'ready' | 'playing' | 'paused' | 'over';

interface Ctx {
  log: string[];
  lives: number;
}

function makeMachine() {
  const ctx: Ctx = { log: [], lives: 3 };
  const machine = new StateMachine<Ctx, Phase>(ctx, 'ready', {
    transitions: {
      ready: ['playing'],
      playing: ['paused', 'over'],
      paused: ['playing', 'over'],
      over: ['ready'],
    },
  });
  machine
    .addState('ready', { onEnter: (c, from) => c.log.push(`enter:ready from=${from}`) })
    .addState('playing', {
      onEnter: (c) => c.log.push('enter:playing'),
      onExit: (c, to) => c.log.push(`exit:playing to=${to}`),
      onUpdate: (c) => c.log.push('tick:playing'),
    })
    .addState('paused', { onEnter: (c) => c.log.push('enter:paused') })
    .addState('over', { onEnter: (c) => c.log.push('enter:over') });
  return { ctx, machine };
}

describe('StateMachine', () => {
  it('starts in the initial state and reports it', () => {
    const { machine } = makeMachine();
    expect(machine.current).toBe('ready');
    expect(machine.is('ready')).toBe(true);
    machine.start();
    expect(machine.context.log).toEqual(['enter:ready from=null']);
  });

  it('allows only declared transitions', () => {
    const { machine, ctx } = makeMachine();
    machine.start();
    ctx.log.length = 0;
    expect(machine.can('playing')).toBe(true);
    expect(machine.can('over')).toBe(false);
    expect(machine.transition('over')).toBe(false);
    expect(machine.current).toBe('ready');
    expect(machine.transition('playing')).toBe(true);
    expect(machine.current).toBe('playing');
  });

  it('runs exit/enter hooks in order and fires onTransition', () => {
    const ctx: Ctx = { log: [], lives: 3 };
    const events: string[] = [];
    const machine = new StateMachine<Ctx, Phase>(ctx, 'ready', {
      transitions: { ready: ['playing'], playing: ['over'], paused: [], over: [] },
      onTransition: (e) => events.push(`${e.from}->${e.to}`),
    });
    machine
      .addState('ready', { onExit: (c) => c.log.push('exit:ready') })
      .addState('playing', { onEnter: (c) => c.log.push('enter:playing') })
      .addState('over', {});
    machine.start();
    machine.transition('playing');
    expect(ctx.log).toEqual(['exit:ready', 'enter:playing']);
    expect(events).toEqual(['ready->playing']);
  });

  it('rejects self-transitions', () => {
    const { machine } = makeMachine();
    machine.start();
    machine.transition('playing');
    expect(machine.transition('playing')).toBe(false);
  });

  it('tracks elapsed time and dispatches onUpdate only for the active state', () => {
    const { machine, ctx } = makeMachine();
    machine.start();
    machine.update(0.5);
    expect(ctx.log).not.toContain('tick:playing'); // still ready
    machine.transition('playing');
    ctx.log.length = 0;
    machine.update(1 / 60);
    machine.update(1 / 60);
    expect(ctx.log.filter((l) => l === 'tick:playing')).toHaveLength(2);
    expect(machine.elapsed).toBeCloseTo(2 / 60, 10);
  });

  it('reset() bypasses the transition table', () => {
    const { machine } = makeMachine();
    machine.start();
    // ready → over is not a declared edge…
    machine.reset('over');
    expect(machine.current).toBe('over');
    // …but is now reachable from over.
    machine.transition('ready');
    expect(machine.current).toBe('ready');
  });
});
