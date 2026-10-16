# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-16, after step 1.9a._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1 to 1.8 and 1.9a are done.

- **1.1** Levels are validated JSON files (`packages/sim/levels/`); a run plays a
  figurative 06:00–14:00 shift with 1×/2×/4× speed, pause and restart.
- **1.2** Each level's seed plans its day — initial stock, truck arrivals, orders with
  deadlines — with every box carrying its true attributes.
- **1.3** Operators share the aisles: they wait, detour and give way instead of
  overlapping; idle operators go back to a home cell.
- **1.4** Trucks queue for docks and leave once unloaded. Dispatch is driven by
  orders, earliest deadline first; orders ship on time or late, and open ones at
  14:00 are missed.
- **1.5** Operators have stamina: work drains it, tired operators walk slower, and
  below 25% they take a break at home until back to 90%.
- **1.6** Economy, scored in real time. `economy.ts` derives the wallet, score and
  stars from the run and the level's `economy` block — no new state, so a replay
  recomputes them exactly. **Score** (the same rules in every level): +100 when an
  order ships on time; −40 the moment an order's deadline passes unshipped; +60 if an
  overdue order ships anyway. Shown with a floor of zero; deductions made below zero
  must still be earned back. **Wallet** = starting amount + revenue per shipped order
  − salaries (per operator per shift hour, breaks included) − a penalty per overdue
  order (charged at the deadline) − truck-hours waiting for a dock. It may go
  negative. Nothing is settled at 14:00. **Stars** come from three score thresholds
  in the level file; a test checks three stars are reachable. The HUD shows score
  (with the next star threshold), stars, wallet and overdue orders; the end-of-shift
  summary adds the wallet breakdown. No combo multiplier (see roadmap decisions).

- **1.7** Player actions and the action log. A run is now its level plus the list of
  actions the player took, each stamped with its tick; `actions.ts` validates them
  the same way live and on replay, and `replay(world, log)` recomputes the exact
  final state (tested against a live run). **Hire**: a one-off fee ($150 on Monday),
  only with the cash for it; the operator arrives after the level's delay (30 game
  minutes) at a free home, and is paid from arrival. **Dismiss**: always dearer than
  hiring ($400, enforced by the level schema), also needs cash; the player chooses who
  leaves (click the figure, or the HUD list for keyboard use), and the operator
  finishes the current task, walks home and leaves — salary stops then. One operator
  always stays; the team is capped at twelve, counting those on the way in. Operator
  ids are unique for the run and each operator has their own home. The HUD gains a
  Team block (hire, arrivals and departures, the selected operator's card) and the
  wallet breakdown gains hiring and dismissal lines. Malformed or impossible log
  entries are rejected, ready for the server-side replay (4.4).

- **1.8a** Staff and robot areas on the floor plan. The plan grows from 26 × 17 to
  26 × 26; the working floor is unchanged, four rows lower. Front wall, behind one
  door each: the canteen on the receiving side (a table with four chairs, a fridge,
  a counter) and the café towards dispatch (a coffee counter and machine, two bistro
  tables with four standing places). Back wall: the robot area — a maintenance
  conveyor through a glass renewal capsule and six induction charging pads — behind
  a wall with no door until Stage 2. All of it is data from `createWarehouse()`
  that the 3D scene and the debug view draw. Walls are low cut-away blocks so the
  isometric camera sees past them; the camera frame widened and shifted so nothing
  sits under the HUD (checked at 1280 × 860, 1366 × 768 and 1024 × 768); the debug
  view uses smaller cells and stays clear of the HUD. Breaks still happen at home.

- **1.8b** Breaks in the staff rooms. A tired operator (below 25%) finishes the task
  and reserves a free place in the room with the most free places — the nearest on a
  tie — so the team spreads across both rooms. Energy recovers **only** while eating
  (canteen chair, back to 90%, about 40 game minutes) or drinking a coffee (café
  standing place, back to 60%, about 12 minutes); walking, queueing or standing idle
  restores nothing (idle operators used to recover a little — no longer). With every
  place taken, they wait on a queue spot beside a door, and the longest wait is seated
  first. A dismissed operator cuts the break short and leaves. Each doorway is three
  cells wide, so up to three people go in or out at once; giving way never sends
  someone from the floor into a doorway or a room. In the scene, diners sit facing the
  table and coffee drinkers stand at a bistro table with a cup; the HUD adds meals,
  coffees and queue time, and the debug view marks the queue spots.

- **1.9a** Deterministic baseline policy (`policy.ts`,
  [ADR 0001](../decisions/0001-baseline-policy.md)) — the fair reference automation
  will be measured against. A free operator picks for an order due within 120 game
  minutes, else unloads, else picks ahead; boxes go to the free slot nearest their
  inbound dock and are picked from the box nearest the order's outbound dock, with each
  colleague already heading down an aisle making it count 12 cells further away. The
  coin toss and random slots are gone: the only randomness left is how people give way.
  Values chosen from a sweep over three seeds.

Measured on Monday (same seed, no player actions), before → after 1.9a:

| Operators | Shipped | Score       | Stars | Final wallet  | Traffic (min) | Walk to break, median | Lowest energy on arrival |
| --------- | ------- | ----------- | ----- | ------------- | ------------- | --------------------- | ------------------------ |
| 2         | 5 → 13  | 0 → 1060    | 0 → 2 | -$761 → $541  | 5 → 2         | 26 → 40 min           | 16% → 5%                 |
| 3         | 11 → 15 | 380 → 1340  | 1 → 2 | $6 → $741     | 22 → 15       | 19 → 29               | 10% → 9%                 |
| 4         | 14 → 15 | 1040 → 1420 | 2 → 2 | $608 → $935   | 37 → 41       | 25 → 40               | 6% → 2%                  |
| 5         | 15 → 17 | 1420 → 1700 | 2 → 3 | $981 → $1349  | 69 → 74       | 22 → 20               | 5% → 4%                  |
| 6         | 14 → 17 | 960 → 1700  | 2 → 3 | $616 → $1276  | 104 → 100     | 32 → 20               | 6% → 4%                  |
| 7         | 16 → 16 | 1520 → 1520 | 3 → 3 | $1000 → $1000 | 149 → 159     | 24 → 19               | 0% → 5%                  |
| 8         | 15 → 18 | 1500 → 1800 | 3 → 3 | $840 → $1140  | 181 → 193     | 24 → 23               | 4% → 0%                  |
| 10        | 18 → 18 | 1800 → 1800 | 3 → 3 | $900 → $900   | 253 → 235     | 30 → 33               | 8% → 9%                  |
| 12        | 18 → 18 | 1800 → 1800 | 3 → 3 | $660 → $660   | 317 → 284     | 28 → 33               | 9% → 11%                 |

Results now follow the team instead of luck (one small dip left: seven ship one less
than six). The baseline is stronger, so **Monday is now too easy**: two operators
earn two stars and five earn three. Re-tuning it is 1.9b. With two operators,
picking for due orders keeps them off the trucks all day (the trucks wait and the
penalty is paid) — an honest cost of understaffing, left in on purpose.

In development, `?operators=N` overrides the team size; production ignores it.

## Next — resume here

Steps 1.1–1.8 are merged into `main`; 1.9a is on `feat/baseline-and-balance`,
awaiting validation. Next is **1.9b**: a balance suite with scripted players (no
purchases; hire whenever affordable up to N) and a `npm run balance` report, then
tuning Monday until it meets its targets — one star with no purchases (M1), at most
two stars with people only (M2), hiring not always best (M3), a visible break queue
(M4), nobody reaching a break below 10% energy (M5).

## Open decisions

- **Monday's starting team earns no star.** With two operators, 14 overdue orders
  (−560) outweigh 5 shipped (+340), so the score ends at 0. The one-pager promises a
  star to a player who buys nothing. Fix in balancing (2.6): fewer or later orders,
  a smaller deduction, or a starting team of three.
- **Hiring is still the strongest move.** The fee only stops hiring without cash;
  at $15/h more people still pays. Monday's lesson (automation pays) needs people to
  cost more — tune against the level 1 balance targets (2.6).
- **Dismissal is out of reach early on Monday.** At $400 it needs more cash than
  the starting $300; the first moment it is affordable depends on deliveries.
  Intended, but worth checking when balancing.
- **Break places vs. the queue.** Eight places rarely run out on Monday, so the
  queue (the visible cost of a team that tires together) seldom shows. Fewer places,
  or longer coffees, would make it a real management problem — tune in balancing
  (1.9 / 2.6); "more break-room places" stays an upgrade (2.7).
- **Urgency window per level.** The baseline's 120-minute urgency window is global
  while deadlines are level data; a level with deadlines under two hours would make
  every order urgent and stop unloading. Revisit with levels 2–5 (5.5), e.g. as a
  share of each order's lead time.
- Outbound trucks are still static; animating them per order is a candidate for the
  control-room work (5.2).
- Hosting for the decision worker — Stage 3.

## Blockers

None.
