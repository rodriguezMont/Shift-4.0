# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1, 1.2 and 1.4a are done.

- **1.1** Levels are validated JSON files (`packages/sim/levels/`); a run plays a
  figurative 06:00–14:00 shift with 1×/2×/4× speed, pause and restart.
- **1.2** Each level's seed plans its day — initial stock, truck arrivals, orders with
  deadlines — with every box carrying its true attributes.
- **1.4a** Receiving is real: trucks arrive on schedule, take a free inbound dock or
  queue for one, and leave once operators have lifted every box. Operators store the
  boxes those trucks brought. Trucks back in and pull away with a short slide and
  fade, opening their rear doors while unloading. When trucks are queuing, operators
  first empty the truck closest to finishing, so a dock frees up sooner. Above each
  inbound door, a single LED shows green (free), amber (occupied) or blinking red
  (one per waiting truck: the docks to free next), under a counter of boxes left on
  the truck. The HUD tracks busy docks, the queue, trucks unloaded and average wait.

Dispatch is still a placeholder: operators ship random stored boxes until 1.4b
drives it from orders.

First signal for balancing: with two operators splitting time with the placeholder
dispatch, Monday ends with 4 of 8 trucks unloaded and an ~87-minute average dock
wait — the "not enough hands" tension the level is meant to create, but far from
the intended easy first day.

## Next

1. **1.3** Several operators and aisle congestion.
2. **1.4b** Picking and dispatch driven by orders and deadlines.
3. **1.5** Operator fatigue and rest.

## Open decisions

- Economy values (salaries, prices, rewards) and Monday's numbers — tuned against
  the level 1 balance targets (2.6).
- Hosting for the decision worker — Stage 3.
- The camera now frames the plant right of the HUD; the full control-room layout
  comes in 5.2.

## Blockers

None.
