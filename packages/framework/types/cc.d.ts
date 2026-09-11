/**
 * Placeholder ambient module for `cc` (Cocos Creator 3.8).
 *
 * This stub exists ONLY so that the Node-side typecheck (`tsc --noEmit`) and
 * vitest do not fail on the barrel file that re-exports the Cocos adapter.
 * The real, exhaustive `cc` typings are shipped inside the Cocos editor and
 * are injected by the editor at build time.
 *
 * DO NOT treat the members declared here as authoritative API surface.
 * Anything the adapter actually depends on is listed in
 * docs/engine-reference/cocos/VERSION.md under "Knowledge gaps / to verify
 * in the editor".
 */
declare module 'cc' {
  export const _decorator: {
    ccclass(name?: string): ClassDecorator;
    property(...args: unknown[]): PropertyDecorator;
  };
  export class Component {
    node: Node;
    enabled: boolean;
    schedule(cb: (dt: number) => void, interval?: number): void;
    unschedule(cb: (dt: number) => void): void;
    scheduleOnce(cb: () => void, delay?: number): void;
  }
  export class Node {
    name: string;
    parent: Node | null;
    constructor(name?: string);
    addChild(child: Node): void;
    removeFromParent(): void;
    destroy(): void;
    getComponent<T>(type: new (...args: never[]) => T): T | null;
    addComponent<T>(type: new (...args: never[]) => T): T;
    setPosition(x: number, y: number, z?: number): void;
    active: boolean;
  }
  export class Graphics extends Component {
    clear(): void;
    rect(x: number, y: number, w: number, h: number): void;
    circle(x: number, y: number, r: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
    fill(): void;
    stroke(): void;
    fillColor: Color;
    strokeColor: Color;
    lineWidth: number;
  }
  export class Color {
    constructor(r?: number, g?: number, b?: number, a?: number);
    static WHITE: Color;
    static BLACK: Color;
  }
  export class UITransform extends Component {
    setContentSize(w: number, h: number): void;
    width: number;
    height: number;
  }
  export class Label extends Component {
    string: string;
    fontSize: number;
  }
  export class director {
    static getDeltaTime(): number;
    static getTotalTime(): number;
  }
  export class game {
    static on(type: string, cb: () => void): void;
    static off(type: string, cb: () => void): void;
  }
  export class Canvas extends Component {}
}
