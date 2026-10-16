import { describe, expect, it } from 'vitest';
import { economyOf, ledgerOf, ORDER_POINTS, scoreOf, starsFor } from './economy';
import { overdueOrderCount } from './orders';
import { createInitialState, step, type SimState, type SimStats } from './simulation';
import { testWorld } from './testing';

/** 480 shift minutes over 4800 ticks: one tick is 0.1 minutes, 600 ticks an hour. */
const world = testWorld({ durationTicks: 4800 });
const initial = createInitialState(world);
const { penalties } = world.level.economy;
/** The first order to fall due. Deadlines are at least an hour after release. */
const firstDeadline = Math.min(...world.scenario.orders.map((order) => order.deadlineTick));

/** Before any deadline unless `tick` says otherwise; no order has shipped. */
function withStats(stats: Partial<SimStats>, tick = 100): SimState {
  return { ...initial, tick, stats: { ...initial.stats, ...stats } };
}

describe('economyOf', () => {
  it('starts the shift with the level wallet, no score and no stars', () => {
    expect(economyOf(world, initial)).toEqual({
      ledger: {
        revenue: 0,
        salaries: 0,
        hiringFees: 0,
        dismissalCosts: 0,
        overduePenalties: 0,
        truckWaitPenalties: 0,
      },
      wallet: world.level.economy.startingWallet,
      score: 0,
      stars: 0,
    });
  });

  it('books revenue, salaries, staffing and truck waiting from the run statistics', () => {
    const state = withStats({
      ordersShipped: 5,
      ordersLate: 2,
      staffTicks: 6000, // ten operator-hours
      dockWaitTicks: 1200, // two truck-hours
      hires: 2,
      dismissals: 1,
    });
    expect(ledgerOf(world, state)).toEqual({
      revenue: 500,
      salaries: 100,
      hiringFees: 300,
      dismissalCosts: 400,
      overduePenalties: 0,
      truckWaitPenalties: 60,
    });
    expect(economyOf(world, state).wallet).toBe(1000 + 500 - 100 - 300 - 400 - 60);
  });

  it('charges an overdue order the moment its deadline passes, not at the end', () => {
    const shipped = { ordersShipped: 3 };
    const onDeadline = economyOf(world, withStats(shipped, firstDeadline));
    const pastDeadline = economyOf(world, withStats(shipped, firstDeadline + 1));

    expect(onDeadline.ledger.overduePenalties).toBe(0);
    expect(onDeadline.score).toBe(3 * ORDER_POINTS.onTime);
    expect(pastDeadline.ledger.overduePenalties).toBe(penalties.overdueOrder);
    expect(pastDeadline.score).toBe(3 * ORDER_POINTS.onTime - ORDER_POINTS.overdue);
  });

  it('lets the wallet go negative', () => {
    const state = withStats({ staffTicks: 600 * 200 }); // 200 operator-hours of salary
    expect(economyOf(world, state).wallet).toBeLessThan(0);
  });
});

describe('scoreOf', () => {
  it('weighs on-time orders above late ones', () => {
    const score = scoreOf(world, withStats({ ordersShipped: 5, ordersLate: 2 }));
    expect(score).toBe(3 * ORDER_POINTS.onTime + 2 * ORDER_POINTS.late);
  });

  it('keeps a late order worth shipping after its deduction', () => {
    expect(ORDER_POINTS.late).toBeGreaterThan(ORDER_POINTS.overdue);
  });

  it('never shows less than zero, and carries the debt until it is earned back', () => {
    const end = world.level.shift.durationTicks;
    const overdue = overdueOrderCount(world.scenario, initial.orders, end);
    expect(overdue).toBeGreaterThan(2);
    expect(scoreOf(world, withStats({}, end))).toBe(0);
    // One delivery does not lift the score while the deductions outweigh it.
    expect(scoreOf(world, withStats({ ordersShipped: 1 }, end))).toBe(0);
  });

  it('moves in real time: up on deliveries, down on deadlines', () => {
    const understaffed = testWorld({ operators: 1 });
    let state = createInitialState(understaffed);
    let previous = 0;
    let rises = 0;
    let falls = 0;
    while (state.tick < understaffed.level.shift.durationTicks) {
      state = step(understaffed, state);
      const { score } = economyOf(understaffed, state);
      if (score > previous) rises++;
      if (score < previous) falls++;
      previous = score;
    }
    expect(rises).toBeGreaterThan(0);
    expect(falls).toBeGreaterThan(0);
  });
});

describe('starsFor', () => {
  it.each([
    [0, 0],
    [99, 0],
    [100, 1],
    [499, 1],
    [500, 2],
    [900, 3],
    [5000, 3],
  ])('gives a score of %i %i stars', (score, stars) => {
    expect(starsFor(world, score)).toBe(stars);
  });
});
