# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15, after step 1.6._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1 to 1.6 are done.

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

Measured on Monday (headless browser, same seed; provisional values: $300 start,
$15/h salary, $100 per order, $60 per overdue order, $30 per truck-hour, stars at
200 / 900 / 1500):

| Operators | Shipped | Late | Overdue | Score | Stars | Salaries | Penalties | Final wallet |
| --------- | ------- | ---- | ------- | ----- | ----- | -------- | --------- | ------------ |
| 2         | 5 of 18 | 4    | 14      | 0     | 0     | $240     | $1,321    | -$761        |
| 6         | 13      | 4    | 6       | 900   | 2     | $720     | $366      | $514         |
| 12        | 18      | 0    | 0       | 1800  | 3     | $1,440   | $0        | $660         |

Sampling the HUD every half second confirmed the real-time behaviour: with two
operators the score first drops at 08:19 (100 → 60), and the wallet at 13:59 already
matches the final one within a tick of salary. The operation itself is unchanged
from 1.5 (same shipped, late and truck counts): the economy only reads the run.

In development, `?operators=N` overrides the team size; production ignores it.

## Next — resume here

Steps 1.1–1.5 are merged into `main`; 1.6 is on `feat/economy`, awaiting
validation. Next is **1.7**: player actions (hire and dismiss, with arrival delay)
recorded in an action log, then **1.8** baseline policy and automated balance tests.

For 1.7, hiring must cost money and be blocked while the wallet cannot pay for it
(decided in 1.6): the score ignores spending, so without that gate hiring the
maximum team would always be the best move.

## Open decisions

- **Monday's starting team now earns no star.** With two operators, 14 overdue
  orders (−560) outweigh 5 shipped (+340), so the score ends at 0. The one-pager
  promises a star to a player who buys nothing. Fix in balancing (2.6): fewer or
  later orders on Monday, a smaller deduction, or a starting team of three.
- **Hiring is currently the dominant strategy.** At $15/h, twelve operators earn
  both the best score and the best wallet on Monday. Monday's lesson (hire an AI
  Analyst, buy a robot) needs people to be expensive enough that automation pays —
  tune salaries and prices against the level 1 balance targets (2.6).
- **Staggered breaks.** A team that starts together tires together. Options: a fixed
  baseline rota, a player control, or a decision for the decision engine (Stage 2/3).
  To settle before balancing.
- Outbound trucks are still static; animating them per order is a candidate for the
  control-room work (5.2).
- Hosting for the decision worker — Stage 3.

## Blockers

None.
