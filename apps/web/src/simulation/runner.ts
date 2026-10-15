import {
  createInitialState,
  createWorld,
  isShiftOver,
  operatorPosition,
  step,
  TICKS_PER_SECOND,
  type LevelConfig,
  type Point,
  type SimState,
  type Warehouse,
  type World,
} from '@shift40/sim';

const TICK_SECONDS = 1 / TICKS_PER_SECOND;
/** Caps catch-up after a stalled frame (e.g. a background tab) so the loop never spirals. */
const MAX_FRAME_SECONDS = 0.25;

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Frame {
  readonly previous: SimState;
  readonly current: SimState;
  /** Fraction of a tick elapsed since `current`, in [0, 1). */
  readonly alpha: number;
}

/** Player-facing playback state. Replaced (never mutated) on change, for React snapshots. */
export interface Playback {
  readonly speed: Speed;
  readonly paused: boolean;
  readonly finished: boolean;
}

/**
 * Drives the simulation at a fixed tick rate, decoupled from the display refresh rate.
 * Speed only changes how many ticks run per real second, so it never affects the outcome.
 * Views read `previous`/`current` plus `alpha` each frame and interpolate between them.
 */
export class SimulationRunner {
  readonly world: World;
  /** Shortcut to `world.warehouse`, the static floor plan views draw. */
  readonly warehouse: Warehouse;
  private previous: SimState;
  private current: SimState;
  private playback: Playback = { speed: 1, paused: false, finished: false };
  private accumulator = 0;
  private lastTime: number | null = null;
  private frameId: number | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(level: LevelConfig) {
    this.world = createWorld(level);
    this.warehouse = this.world.warehouse;
    this.current = createInitialState(this.world);
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

  /** Sets the speed and resumes play. Ignored once the shift is over. */
  setSpeed(speed: Speed): void {
    if (this.playback.finished) return;
    this.updatePlayback({ speed, paused: false });
  }

  togglePause(): void {
    if (this.playback.finished) return;
    this.updatePlayback({ paused: !this.playback.paused });
  }

  /** Starts the same shift again from its first tick. */
  restart(): void {
    this.current = createInitialState(this.world);
    this.previous = this.current;
    this.accumulator = 0;
    this.playback = { ...this.playback, paused: false, finished: false };
    this.notify();
  }

  /** Latest settled state; changes once per tick. Shaped for `useSyncExternalStore`. */
  readonly getState = (): SimState => this.current;

  readonly getPlayback = (): Playback => this.playback;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The last two ticks and how far the display is between them, for smooth rendering. */
  frame(): Frame {
    return {
      previous: this.previous,
      current: this.current,
      alpha: this.accumulator / TICK_SECONDS,
    };
  }

  /** Operator position smoothed between the last two ticks. */
  operatorAt(index: number): Point | null {
    const { previous, current, alpha } = this.frame();
    const now = current.operators[index];
    if (now === undefined) return null;
    const from = operatorPosition(previous.operators[index] ?? now);
    const to = operatorPosition(now);
    return { x: from.x + (to.x - from.x) * alpha, y: from.y + (to.y - from.y) * alpha };
  }

  private updatePlayback(change: Partial<Playback>): void {
    this.playback = { ...this.playback, ...change };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private readonly loop = (time: number): void => {
    const elapsed =
      this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = time;
    this.frameId = requestAnimationFrame(this.loop);

    const { paused, finished, speed } = this.playback;
    if (paused || finished) return;

    this.accumulator += elapsed * speed;
    let ticked = false;
    while (this.accumulator >= TICK_SECONDS) {
      this.previous = this.current;
      this.current = step(this.world, this.current);
      this.accumulator -= TICK_SECONDS;
      ticked = true;
      if (isShiftOver(this.world.level, this.current.tick)) {
        // Settle on the final state so nothing keeps interpolating past the end.
        this.previous = this.current;
        this.accumulator = 0;
        this.playback = { ...this.playback, finished: true };
        break;
      }
    }
    if (ticked) this.notify();
  };
}
