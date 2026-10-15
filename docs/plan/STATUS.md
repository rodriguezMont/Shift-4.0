# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15._

## Where we are

**Stage 0 — Foundation: done.** The repository has CI, an MIT license, contributor
rules (`CLAUDE.md`), a deterministic simulation core with tests, and an isometric
prototype where one operator runs the receive → store → dispatch cycle. Product
direction and the staged plan are written down in the
[one-pager](../product/one-pager.md) and the [roadmap](ROADMAP.md).

## Next

**Stage 1 — Game core**, starting with:

1. **1.1** Level configuration format, shift clock, speed controls and pause.
2. **1.2** Seeded scenario generator for trucks, orders and items.
3. **1.3** Several operators and aisle congestion.

## Open decisions

- Economy values (salaries, prices, rewards) — during Stage 1 and 2 balancing.
- Hosting for the decision worker — Stage 3.

## Blockers

None.
