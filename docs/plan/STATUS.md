# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15._

## Where we are

**Stage 1 — Game core: in progress.** Step 1.1 is done: levels are validated JSON
files (`packages/sim/levels/`), the first one being Monday. A run now plays a
figurative 06:00–14:00 shift that ends on its own, with 1×/2×/4× speed, pause and
restart. Speed changes only how many ticks run per second, never the outcome.

Stage 0 (foundation) is complete; see the [roadmap](ROADMAP.md) and the
[one-pager](../product/one-pager.md).

## Next

1. **1.2** Seeded scenario generator for trucks, orders and items.
2. **1.3** Several operators and aisle congestion.
3. **1.4** Full flow: receive → store → pick → dispatch within deadline.

## Open decisions

- Economy values (salaries, prices, rewards) — during Stage 1 and 2 balancing.
- Hosting for the decision worker — Stage 3.
- The HUD overlaps the top inbound truck at common screen sizes — to be solved with
  the control-room layout (5.2).

## Blockers

None.
