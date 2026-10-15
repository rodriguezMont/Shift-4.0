# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1 and 1.2 are done.

- **1.1** Levels are validated JSON files (`packages/sim/levels/`); a run plays a
  figurative 06:00–14:00 shift with 1×/2×/4× speed, pause and restart.
- **1.2** Each level's seed now plans its day: initial stock, truck arrivals and
  orders with deadlines, generated from settings in the level file (counts, size
  ranges, deadline ranges, demand peaks, fragile share). Every box carries its true
  attributes for later scoring. The HUD shows the plan unfolding. Scenario and
  simulation draw from independent random streams.

Trucks and orders are planned but not yet handled: operators still run the
placeholder putaway/dispatch loop until 1.4 wires the real flow.

## Next

1. **1.3** Several operators and aisle congestion.
2. **1.4** Full flow: receive → store → pick → dispatch within deadline.
3. **1.5** Operator fatigue and rest.

## Open decisions

- Economy values (salaries, prices, rewards) — during Stage 1 and 2 balancing.
- Monday's arrival counts and timing are first guesses; they get tuned against the
  level 1 balance targets (2.6).
- Hosting for the decision worker — Stage 3.
- The HUD overlaps the top inbound truck at common screen sizes — to be solved with
  the control-room layout (5.2).

## Blockers

None.
