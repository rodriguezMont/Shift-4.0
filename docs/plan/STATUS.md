# Status

_Rewritten at the end of each step — current state only. Last update: 2026-10-15, after step 1.5._

## Where we are

**Stage 1 — Game core: in progress.** Steps 1.1 to 1.5 are done.

- **1.1** Levels are validated JSON files (`packages/sim/levels/`); a run plays a
  figurative 06:00–14:00 shift with 1×/2×/4× speed, pause and restart.
- **1.2** Each level's seed plans its day — initial stock, truck arrivals, orders with
  deadlines — with every box carrying its true attributes.
- **1.3** Operators share the aisles: they wait, detour and give way instead of
  overlapping; idle operators go back to a home cell.
- **1.4** Trucks queue for docks and leave once unloaded (single-LED signals and
  boxes-left counters on each inbound door). Dispatch is driven by orders, earliest
  deadline first; orders ship on time or late, and open ones at 14:00 are missed.
- **1.5** Operators have stamina. Walking, carrying and handling drain it; tired
  operators walk slower (down to 70% of full speed). Below 25% an operator finishes
  the current task, walks home and rests until back to 90% — about 45 game minutes.
  Rates are defined per shift, so a level's real-time length never changes how
  tiring the day is. Each operator shows an energy bar once tired (blue on a break).

Measured on Monday (headless browser, same seed):

| Operators | Orders shipped | Late | Missed | Trucks unloaded | Break time | Lost in aisles |
| --------- | -------------- | ---- | ------ | --------------- | ---------- | -------------- |
| 2         | 5 of 18        | 4    | 13     | 1 of 8          | 91 min     | 9 min          |
| 6         | 13 of 18       | 4    | 5      | 5 of 8          | 286 min    | 127 min        |
| 12        | 18 of 18       | 0    | 0      | 8 of 8          | 233 min    | 337 min        |

Fatigue changed the picture from 1.4: six operators are no longer enough, because a
team that starts together tires together — around noon most of them need a break
at once and output collapses for a while.

In development, `?operators=N` overrides the team size; production ignores it.

## Next — resume here

Everything above is merged into `main` (PRs #1–#10). The next step is **1.6, the
economy**. What is already decided for it (see the one-pager and roadmap decisions):

- **Wallet and score are separate.** The score counts only what the operation
  delivered (orders shipped, on time weighing more than late) and never goes down;
  the wallet pays salaries and purchases. Investing never lowers the score.
- **Costs and penalties:** salaries per operator per minute of shift; penalties for
  late and missed orders and for trucks kept waiting at the docks.
- **Stars:** 1–3 per level from score thresholds set in the level file; one star
  unlocks the next level. Each level must be winnable with one star by its starting
  team (enforced later by balance tests, 1.8 / 2.6).
- Keep values in level files and constants, not in the view; show wallet, score and
  stars in the HUD and the end-of-shift summary.

After 1.6: **1.7** player actions (hire and dismiss, with arrival delay) recorded in
an action log, then **1.8** baseline policy and automated balance tests.

## Open decisions

- **Staggered breaks.** Synchronised exhaustion is realistic and makes a good
  management problem. Options: a fixed baseline rota (e.g. at most a third of the
  team on break), a player control, or a decision for the decision engine (Stage 2/3).
  To settle before balancing.
- Economy values and Monday's numbers — tuned against the level 1 balance targets
  (2.6).
- Outbound trucks are still static; animating them per order is a candidate for the
  control-room work (5.2).
- Hosting for the decision worker — Stage 3.

## Blockers

None.
