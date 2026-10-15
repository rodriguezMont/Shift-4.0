/**
 * Mulberry32 PRNG expressed as a pure function over a 32-bit state, so the random stream
 * lives inside the (serialisable) simulation state and a seed fully determines a run.
 *
 * @returns a float in [0, 1) and the next state.
 */
export function nextRandom(state: number): [value: number, state: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** @returns an integer in [0, maxExclusive) and the next state. */
export function randomInt(state: number, maxExclusive: number): [value: number, state: number] {
  const [value, next] = nextRandom(state);
  return [Math.floor(value * maxExclusive), next];
}
