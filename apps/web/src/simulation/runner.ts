import {
  createInitialState,
  createWarehouse,
  operatorPosition,
  step,
  TICKS_PER_SECOND,
  type Point,
  type SimState,
  type Warehouse,
} from '@shift40/sim';

const TICK_SECONDS = 1 / TICKS_PER_SECOND;
/** Caps catch-up after a stalled frame (e.g. a background tab) so the loop never spirals. */
const MAX_FRAME_SECONDS = 0.25;

/**
 * Drives the simulation at a fixed tick rate, decoupled from the display refresh rate.
 * Views read `previous`/`current` plus `alpha` each frame and interpolate between them.
 */
export class SimulationRunner {
  readonly warehouse: Warehouse = createWarehouse();
  private previous: SimState;
  private current: SimState;
  private accumulator = 0;
  private lastTime: number | null = null;
  private frameId: number | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(seed: number, operatorCount: number) {
    this.current = createInitialState(this.warehouse, { seed, operatorCount });
    this.previous = this.current;
  }

  start(): void {
    if (this.frameId !== null) return;
    this.lastTime = null;
    this.frameId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.frameId === null) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  /** Latest settled state; changes once per tick. Shaped for `useSyncExternalStore`. */
  readonly getState = (): SimState => this.current;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Operator position smoothed between the last two ticks. */
  operatorAt(index: number): Point | null {
    const current = this.current.operators[index];
    if (current === undefined) return null;
    const from = operatorPosition(this.previous.operators[index] ?? current);
    const to = operatorPosition(current);
    const alpha = this.accumulator / TICK_SECONDS;
    return { x: from.x + (to.x - from.x) * alpha, y: from.y + (to.y - from.y) * alpha };
  }

  private readonly loop = (time: number): void => {
    const elapsed =
      this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = time;
    this.accumulator += elapsed;

    let ticked = false;
    while (this.accumulator >= TICK_SECONDS) {
      this.previous = this.current;
      this.current = step(this.warehouse, this.current);
      this.accumulator -= TICK_SECONDS;
      ticked = true;
    }
    if (ticked) {
      for (const listener of this.listeners) listener();
    }

    this.frameId = requestAnimationFrame(this.loop);
  };
}
