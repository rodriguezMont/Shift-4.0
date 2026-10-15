import { describe, expect, it } from 'vitest';
import { needsRest, nextEnergy, REST_BELOW, speedFactor } from './fatigue';

const SHIFT = 2000;

describe('fatigue', () => {
  it('drains energy with work and restores it with rest', () => {
    expect(nextEnergy(0.5, 'walking', SHIFT)).toBeLessThan(0.5);
    expect(nextEnergy(0.5, 'handling', SHIFT)).toBeLessThan(0.5);
    expect(nextEnergy(0.5, 'resting', SHIFT)).toBeGreaterThan(0.5);
    expect(nextEnergy(0.5, 'waiting', SHIFT)).toBeGreaterThan(0.5);
    expect(nextEnergy(0.5, 'still', SHIFT)).toBe(0.5);
  });

  it('makes carrying a box more tiring than walking empty-handed', () => {
    expect(nextEnergy(0.5, 'carrying', SHIFT)).toBeLessThan(nextEnergy(0.5, 'walking', SHIFT));
  });

  it('keeps energy between 0 and 1', () => {
    expect(nextEnergy(0, 'carrying', SHIFT)).toBe(0);
    expect(nextEnergy(1, 'resting', SHIFT)).toBe(1);
  });

  it('slows tired operators down, to 70% of full speed when exhausted', () => {
    expect(speedFactor(1)).toBe(1);
    expect(speedFactor(0)).toBeCloseTo(0.7);
    expect(speedFactor(0.5)).toBeGreaterThan(speedFactor(0.2));
  });

  it('calls for a break below the threshold', () => {
    expect(needsRest(REST_BELOW - 0.01)).toBe(true);
    expect(needsRest(REST_BELOW)).toBe(false);
  });
});
