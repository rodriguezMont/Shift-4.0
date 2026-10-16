# ADR 0001 — A deterministic baseline policy as the fair reference

- **Status:** accepted
- **Date:** 2026-10-16
- **Step:** 1.9a

## Context

Every claim Shift 4.0 makes about automation is a comparison: the same day, on the
same seed, run once by the operation as it is and once with the AI Analyst, robots and
decision engine (Stage 2 and 3). The "as it is" side — the baseline policy — decides
what a free operator does next. If it is weak, any automation looks good; if it is
noisy, no comparison or balance target can be trusted.

Until step 1.8 the baseline was a placeholder:

- when an operator could either unload a truck or pick for an order, it **tossed a
  coin**;
- unloaded boxes went to a **random free slot**, and orders were picked from a
  **random stored box**;
- orders were served earliest deadline first.

Measured on Monday with 2 to 12 operators, results were noisy rather than shaped by
the team: four operators out-shipped six, nine shipped less than seven. A balance test
built on that would be measuring dice.

## Decision

The baseline is a deterministic heuristic of the kind a sensible shift supervisor
applies, kept in one module (`packages/sim/src/policy.ts`):

1. **What to do next.** Pick for the most urgent order when it falls due within
   `URGENT_WITHIN_MINUTES` (120 game minutes); otherwise unload if a truck has a box
   and a slot is free; otherwise pick ahead for the next order.
2. **Where to store a box.** The free slot nearest to the inbound dock it came from.
3. **Which box to pick.** The stored box nearest to the order's outbound dock.
4. **Spread the team.** Each colleague already heading for a slot in an aisle makes
   that aisle count `BUSY_AISLE_PENALTY` (12) cells further away, so people are not all
   sent down the aisle nearest the door.
5. Orders stay earliest-deadline-first; break rooms keep their own rule (most free
   places, then nearest).

Ties always go to the lowest id. The only randomness left in a run is how people
give way to each other in the aisles.

## Alternatives considered

- **Keep the coin toss.** Rejected: it makes results depend on luck, not on the team
  or the player's decisions.
- **Nearest slot without spreading the team.** Tried first. It removed the noise but
  sent everyone down the same aisle: with twelve operators, time lost to traffic
  doubled (from 317 to 627 minutes a shift) and a five-person team shipped less than a
  four-person one. A supervisor would not do that.
- **An optimising planner** (look-ahead assignment, routing). Rejected for the
  baseline: it is what automation is supposed to bring, so it belongs on the other
  side of the comparison.

## How the values were chosen

`URGENT_WITHIN_MINUTES` ∈ {30, 60, 90, 120} and `BUSY_AISLE_PENALTY` ∈ {0, 4, 8, 12,
20} were swept on Monday for teams of 2 to 12, on three seeds. 120 minutes and 12
cells shipped the most orders in total (549 across the three seeds) with the fewest
cases of a bigger team doing worse (one in 33), and held time lost to traffic near the
lowest seen.

Monday (seed 20261019), no player actions:

| Operators | Shipped before → after | Score before → after | Traffic (min) before → after |
| --------- | ---------------------- | -------------------- | ---------------------------- |
| 2         | 5 → 13                 | 0 → 1060             | 5 → 2                        |
| 4         | 14 → 15                | 1040 → 1420          | 37 → 41                      |
| 6         | 14 → 17                | 960 → 1700           | 104 → 100                    |
| 8         | 15 → 18                | 1500 → 1800          | 181 → 193                    |
| 12        | 18 → 18                | 1800 → 1800          | 317 → 284                    |

## Consequences

- Results now follow the team: more people ship more, with one small dip left (seven
  operators ship one order less than six).
- The baseline is stronger, so Monday became easier: two operators already earn two
  stars and five earn three. Re-tuning the level against its targets is step 1.9b.
- Changing `policy.ts` changes every measured result; the balance tests of step 1.9b
  are what will catch it.
- The decision engine of step 2.4 replaces or wraps these functions; the comparison it
  is judged by is this baseline on the same seed.
- With two operators, picking for due orders keeps them off the trucks all day: the
  trucks wait and their penalty is paid. That is the honest cost of an understaffed
  shift, and it is left in.
