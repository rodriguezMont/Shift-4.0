import { tickAtMinute } from './clock';
import { at } from './geometry';
import type { ArrivalStream, LevelConfig, Range } from './level';
import { deriveSeed, nextRandom } from './rng';

/** Random stream id for scenario generation; the simulation draws from its own stream. */
const SCENARIO_STREAM = 1;
/** Arrivals stop this long before the shift ends, so the last ones can still be handled. */
const ARRIVAL_CUTOFF_MINUTES = 60;

/** A physical box. `fragile` is ground truth: decision makers must infer it, never read it. */
export interface Item {
  readonly id: number;
  readonly fragile: boolean;
}

export interface StockedItem {
  readonly itemId: number;
  readonly slotId: number;
}

export interface TruckArrival {
  readonly id: number;
  readonly arrivalTick: number;
  readonly itemIds: readonly number[];
}

export interface Order {
  readonly id: number;
  readonly releaseTick: number;
  readonly deadlineTick: number;
  /** Boxes the order needs, served from any stock. */
  readonly quantity: number;
}

/** The plan of the day: everything that will arrive, fixed before the shift starts. */
export interface Scenario {
  readonly items: readonly Item[];
  readonly initialStock: readonly StockedItem[];
  /** Sorted by arrival. */
  readonly trucks: readonly TruckArrival[];
  /** Sorted by release. */
  readonly orders: readonly Order[];
}

/**
 * Plans a level's day from its seed: initial stock, truck arrivals and orders.
 * Pure and deterministic — the same level always yields the same scenario.
 *
 * Each section draws from its own random stream, so tuning one knob (say, the number
 * of trucks) never reshuffles the others — which keeps balance changes isolated.
 */
export function generateScenario(level: LevelConfig, slotCount: number): Scenario {
  const { scenario } = level;
  const stream = (section: number) => new Random(deriveSeed(level.seed, SCENARIO_STREAM + section));
  const items: Item[] = [];
  const newItem = (random: Random): number => {
    items.push({ id: items.length, fragile: random.next() < scenario.fragileRatio });
    return items.length - 1;
  };

  const stock = stream(0);
  const stockedSlots = stock.sample(slotCount, Math.round(slotCount * scenario.initialStock));
  const initialStock = stockedSlots.map((slotId) => ({ itemId: newItem(stock), slotId }));

  const truckRandom = stream(1);
  const trucks = arrivalMinutes(truckRandom, level, scenario.trucks, 0).map(
    (minute, id): TruckArrival => {
      const boxes = truckRandom.between(scenario.trucks.boxes);
      return {
        id,
        arrivalTick: tickAtMinute(level, minute),
        itemIds: Array.from({ length: boxes }, () => newItem(truckRandom)),
      };
    },
  );

  // Orders stop early enough that even the shortest deadline fits inside the shift;
  // longer deadlines are capped at the end of the shift.
  const orderRandom = stream(2);
  const [shortestDeadline] = scenario.orders.deadlineMinutes;
  const orders = arrivalMinutes(orderRandom, level, scenario.orders, shortestDeadline).map(
    (minute, id): Order => {
      const deadline = minute + orderRandom.between(scenario.orders.deadlineMinutes);
      return {
        id,
        releaseTick: tickAtMinute(level, minute),
        deadlineTick: tickAtMinute(level, Math.min(deadline, level.shift.endMinute)),
        quantity: orderRandom.between(scenario.orders.boxes),
      };
    },
  );

  return { items, initialStock, trucks, orders };
}

/**
 * Samples `stream.count` arrival minutes, sorted, from the shift start up to the cutoff
 * (an hour before the end, or `minLeadMinutes` if longer). Each minute is weighted 1, or
 * by the strongest peak covering it; peaks after the cutoff have no effect.
 */
function arrivalMinutes(
  random: Random,
  level: LevelConfig,
  stream: ArrivalStream,
  minLeadMinutes: number,
): number[] {
  const { startMinute, endMinute } = level.shift;
  const cutoff = Math.max(ARRIVAL_CUTOFF_MINUTES, minLeadMinutes);
  const lastMinute = Math.max(startMinute + 1, endMinute - cutoff);

  const cumulative: number[] = [];
  let total = 0;
  for (let minute = startMinute; minute < lastMinute; minute++) {
    const inside = stream.peaks.filter((p) => minute >= p.startMinute && minute < p.endMinute);
    total += Math.max(1, ...inside.map((p) => p.weight));
    cumulative.push(total);
  }

  const minutes = Array.from(
    { length: stream.count },
    () => startMinute + firstAbove(cumulative, random.next() * total),
  );
  return minutes.sort((a, b) => a - b);
}

/** Index of the first element greater than `value` in an ascending array. */
function firstAbove(sorted: readonly number[], value: number): number {
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sorted[middle] ?? Infinity) > value) high = middle;
    else low = middle + 1;
  }
  return low;
}

/** A cursor over the pure PRNG, local to one generation run. */
class Random {
  constructor(private state: number) {}

  /** A float in [0, 1). */
  next(): number {
    const [value, state] = nextRandom(this.state);
    this.state = state;
    return value;
  }

  /** An integer in the inclusive range. */
  between([min, max]: Range): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** `count` distinct integers from [0, size), via a partial Fisher–Yates shuffle. */
  sample(size: number, count: number): number[] {
    const pool = Array.from({ length: size }, (_, index) => index);
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(this.next() * (size - i));
      [pool[i], pool[j]] = [at(pool, j), at(pool, i)];
    }
    return pool.slice(0, count);
  }
}
