# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1 to 1.4 are done.

- **1.1** Levels are validated JSON files (`packages/sim/levels/`); a run plays a
  figurative 06:00–14:00 shift with 1×/2×/4× speed, pause and restart.
- **1.2** Each level's seed plans its day — initial stock, truck arrivals, orders with
  deadlines — with every box carrying its true attributes.
- **1.3** Operators share the aisles: they wait, detour and give way instead of
  overlapping; idle operators go back to a home cell. Time lost to congestion is
  tracked.
- **1.4a** Trucks queue for inbound docks and leave once unloaded; when trucks are
  waiting, operators empty the one closest to finishing first. Each inbound door has
  a single-LED signal and a boxes-left counter.
- **1.4b** Dispatch is driven by orders: a released order needs N boxes from stock at
  its outbound dock before its deadline. The baseline picks for the order due soonest.
  Orders ship on time or late; released orders still open at 14:00 are missed. With
  no open orders, operators only store boxes or wait at home.

Measured on Monday (headless browser, same seed):

| Operators | Orders shipped | Late | Missed | Trucks unloaded | Lost in aisles |
| --------- | -------------- | ---- | ------ | --------------- | -------------- |
| 2         | 8 of 18        | 7    | 10     | 2 of 8          | 7 min          |
| 6         | 18 of 18       | 0    | 0      | 8 of 8          | 148 min        |
| 12        | 18 of 18       | 0    | 0      | 8 of 8          | 292 min        |

Two operators cannot cope; six are enough; twelve add nothing but congestion. Once
salaries exist (1.6), over-hiring will cost money as well as aisle time.

In development, `?operators=N` overrides the team size; production ignores it.

## Next

1. **1.5** Operator fatigue and rest.
2. **1.6** Economy — wallet separate from score — salaries, penalties, star
   thresholds.
3. **1.7** Player actions (hire and dismiss) recorded in an action log.

## Open decisions

- Economy values and Monday's numbers — tuned against the level 1 balance targets
  (2.6). Monday is currently out of reach for its starting team of two, as intended
  for a level that should reward bringing in automation.
- Outbound trucks are still static; animating them per order is a candidate for the
  control-room work (5.2).
- Hosting for the decision worker — Stage 3.

## Blockers

None.
