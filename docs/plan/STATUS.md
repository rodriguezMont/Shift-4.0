# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1, 1.2, 1.3 and 1.4a are done.

- **1.1** Levels are validated JSON files (`packages/sim/levels/`); a run plays a
  figurative 06:00–14:00 shift with 1×/2×/4× speed, pause and restart.
- **1.2** Each level's seed plans its day — initial stock, truck arrivals, orders with
  deadlines — with every box carrying its true attributes.
- **1.3** Operators share the aisles: nobody enters an occupied cell. A blocked
  operator waits, looks for a detour every few ticks, and after a while steps aside
  and gives way, which resolves head-on stand-offs in one-wide aisles. Idle operators
  return to their own home cell by the receiving wall. Time lost to congestion is
  tracked and shown in the HUD.
- **1.4a** Trucks queue for inbound docks and leave once unloaded; operators store
  their real boxes, emptying the truck closest to finishing first when others wait.
  Each inbound door has a single-LED signal and a boxes-left counter.

Measured on Monday (headless browser, same seed), hiring shows diminishing returns:
2 operators complete 27 tasks (13.5 each) and lose 13 min in the aisles; 6 complete
65 (10.8 each), losing 138 min; 12 complete 99 (8.3 each), losing 465 min.

Dispatch is still a placeholder until 1.4b drives it from orders. In development,
`?operators=N` overrides the team size to test crowding; production ignores it.

## Next

1. **1.4b** Picking and dispatch driven by orders and deadlines.
2. **1.5** Operator fatigue and rest.
3. **1.6** Economy — wallet separate from score — and star thresholds.

## Open decisions

- Economy values and Monday's numbers — tuned against the level 1 balance targets
  (2.6).
- Hosting for the decision worker — Stage 3.
- The full control-room layout comes in 5.2.

## Blockers

None.
