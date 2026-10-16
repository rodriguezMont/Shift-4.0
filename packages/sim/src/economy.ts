/**
 * The shift's economy, derived from what the simulation already counts. Nothing here is
 * stored in the state: the wallet, the score and the stars are pure functions of the
 * level and the run, so a replay of the same seed and actions recomputes them exactly.
 *
 * Both move in real time. An order earns its points and revenue the moment it ships;
 * the moment its deadline passes unshipped, the score and the wallet take the hit at
 * once. An overdue order can still ship, for fewer points. Nothing is settled at the
 * end of the shift.
 *
 * The wallet and the score are deliberately separate. The wallet pays salaries, hiring
 * and dismissal costs and penalties, and may go negative (spending then stops); the score only reflects how the operation served its
 * orders, so spending money never costs score.
 */
import { minutesPerTick } from './clock';
import { overdueOrderCount } from './orders';
import type { SimState, SimStats } from './simulation';
import type { World } from './world';

/**
 * Score per order event. The same in every level, so level scores add up fairly.
 * A late order nets `late - overdue`: still worth shipping.
 */
export const ORDER_POINTS = { onTime: 100, late: 60, overdue: 40 } as const;

/** Where the money went, as positive amounts. Fractional until displayed. */
export interface Ledger {
  readonly revenue: number;
  readonly salaries: number;
  readonly hiringFees: number;
  readonly dismissalCosts: number;
  readonly overduePenalties: number;
  readonly truckWaitPenalties: number;
}

export interface Economy {
  readonly ledger: Ledger;
  readonly wallet: number;
  /** Never below zero; see `scoreOf`. */
  readonly score: number;
  /** 0 to 3. */
  readonly stars: number;
}

export function economyOf(world: World, state: SimState): Economy {
  // Counted once: both the ledger and the score need it.
  const overdue = overdueCount(world, state);
  const ledger = bookLedger(world, state.stats, overdue);
  const score = scoreFrom(state.stats, overdue);
  return {
    ledger,
    wallet: walletOf(world, ledger),
    score,
    stars: starsFor(world, score),
  };
}

export function ledgerOf(world: World, state: SimState): Ledger {
  return bookLedger(world, state.stats, overdueCount(world, state));
}

function bookLedger({ level }: World, stats: SimStats, overdue: number): Ledger {
  const { orderRevenue, salaryPerHour, hiringFee, dismissalCost, penalties } = level.economy;
  const hoursPerTick = minutesPerTick(level) / 60;
  return {
    revenue: stats.ordersShipped * orderRevenue,
    salaries: stats.staffTicks * hoursPerTick * salaryPerHour,
    hiringFees: stats.hires * hiringFee,
    dismissalCosts: stats.dismissals * dismissalCost,
    overduePenalties: overdue * penalties.overdueOrder,
    truckWaitPenalties: stats.dockWaitTicks * hoursPerTick * penalties.truckWaitPerHour,
  };
}

export function walletOf({ level }: World, ledger: Ledger): number {
  const costs =
    ledger.salaries +
    ledger.hiringFees +
    ledger.dismissalCosts +
    ledger.overduePenalties +
    ledger.truckWaitPenalties;
  return level.economy.startingWallet + ledger.revenue - costs;
}

/**
 * Points for shipped orders minus deductions for overdue ones, floored at zero. The
 * floor applies to the running total, so deductions made while it is negative still
 * have to be earned back.
 */
export function scoreOf(world: World, state: SimState): number {
  return scoreFrom(state.stats, overdueCount(world, state));
}

function scoreFrom({ ordersShipped, ordersLate }: SimStats, overdue: number): number {
  const earned =
    (ordersShipped - ordersLate) * ORDER_POINTS.onTime + ordersLate * ORDER_POINTS.late;
  return Math.max(0, earned - overdue * ORDER_POINTS.overdue);
}

export function starsFor({ level }: World, score: number): number {
  return level.economy.stars.filter((threshold) => score >= threshold).length;
}

function overdueCount({ scenario }: World, { orders, tick }: SimState): number {
  return overdueOrderCount(scenario, orders, tick);
}
