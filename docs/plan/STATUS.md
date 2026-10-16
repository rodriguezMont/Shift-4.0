# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-16, after step 1.7._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1 to 1.7 are done.

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

Measured on Monday (same seed, no player actions; provisional values: $300 start,
$15/h salary, $100 per order, $60 per overdue order, $30 per truck-hour, stars at
200 / 900 / 1500). Identical to step 1.6 — the refactor and the new actions change
nothing when the player does nothing:

| Operators | Shipped | Late | Overdue | Score | Stars | Salaries | Penalties | Final wallet |
| --------- | ------- | ---- | ------- | ----- | ----- | -------- | --------- | ------------ |
| 2         | 5 of 18 | 4    | 14      | 0     | 0     | $240     | $1,321    | -$761        |
| 6         | 13      | 4    | 6       | 900   | 2     | $720     | $366      | $514         |
| 12        | 18      | 0    | 0       | 1800  | 3     | $1,440   | $0        | $660         |

In the browser: hiring at 06:06 charged $150 and the operator arrived at 06:36 next
to the first dock; with six operators the wallet first reached $450 at 08:35, and
dismissing a busy operator there (paused) took the wallet to $67 — they finished
unloading, walked home and left about 43 game minutes later.

In development, `?operators=N` overrides the team size; production ignores it.

## Next — resume here

Steps 1.1–1.6 are merged into `main`; 1.7 is on `feat/hire-and-dismiss`, awaiting
validation. Next is **1.8**: staff and robot areas. Front wall: a canteen (seated
meal, back to 90%) and a café (standing coffee, back to 60%); energy recovers only
while eating or drinking, and tired workers spread across free places in both
rooms. Back wall: the robot area — maintenance conveyor with a renewal capsule and
induction pads — built now, activated in Stage 2. Then **1.9** baseline policy and
automated balance tests.

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
- **Staggered breaks** become part of 1.8: limited places in the canteen and café
  turn a team that tires together into a visible queue.
- Outbound trucks are still static; animating them per order is a candidate for the
  control-room work (5.2).
- Hosting for the decision worker — Stage 3.

## Blockers

None.
