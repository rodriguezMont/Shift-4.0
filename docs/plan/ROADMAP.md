# Roadmap

From foundation to public launch, in stages and sub-stages. Each sub-stage ships as
one or more small pull requests. Product context lives in the
[one-pager](../product/one-pager.md); current position lives in
[STATUS.md](STATUS.md).

**Status:** ✅ done · 🔄 in progress · ⬜ not started

| Stage                           | Outcome                                                                  | Estimate | Status |
| ------------------------------- | ------------------------------------------------------------------------ | -------- | ------ |
| 0. Foundation                   | Repository, CI, deterministic simulation core, isometric floor prototype | —        | ✅     |
| 1. Game core                    | One level playable end to end with humans only, scored and starred       | ~1 week  | ⬜     |
| 2. Industry 4.0, locally        | AI Analyst, robots and decisions behind an interface, rules engine only  | ~5 days  | ⬜     |
| 3. Jev in production            | Decision service, worker, cache, decision log, spend limits, evaluation  | ~1 week  | ⬜     |
| 4. Accounts, progress, rankings | Anonymous play, Google/GitHub linking, server-validated scores           | ~1 week  | ⬜     |
| 5. Experience and content       | Control-room UI, guided level 1, levels 2–5, end-of-shift report, `/ops` | ~1 week  | ⬜     |
| 6. Deploy and launch            | Hosting, security and performance pass, e2e tests, README, launch        | ~4 days  | ⬜     |

**Total: about six weeks.**

**Launch cut line.** If time runs short, the first public release ships with Monday
and Tuesday playable; Wednesday to Friday follow as updates. Jev is never cut — it
ships before rankings if something has to slip.

## How the stages map to the four pillars

| Pillar         | Where it is evidenced                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Full stack     | React/three.js client, decision service and worker, Postgres with RLS, OAuth, shared typed contracts     |
| Engineering    | Deterministic simulation, server-side replay, cache and idempotency, balance tests, CI, e2e, ADRs        |
| Productization | One-pager, two-audience onboarding, level progression, success metrics, first-party product events       |
| Embedded AI    | Typed decisions with confidence, human-in-the-loop threshold, fallbacks, evaluation, live system metrics |

## Stage 0 — Foundation ✅

- ✅ 0.1 npm workspaces monorepo, strict TypeScript, ESLint, Prettier, Vitest
- ✅ 0.2 Deterministic simulation core: seeded PRNG in state, A\* pathfinding, slot
  reservations, one operator running the putaway/dispatch cycle
- ✅ 0.3 Isometric react-three-fiber view with fixed-timestep runner and 2D debug view
- ✅ 0.4 MIT license and GitHub Actions CI (check + build, SHA-pinned actions)
- ✅ 0.5 `CLAUDE.md` with engineering, architecture and public-repository rules
- ✅ 0.6 Product one-pager, roadmap and status

## Stage 1 — Game core

Goal: one level playable end to end with human operators only.

- ⬜ 1.1 Level configuration format; shift clock (06:00–14:00); speed 1×/2×/4× and pause
- ⬜ 1.2 Seeded scenario generator: truck arrivals, orders with deadlines, items with
  true attributes
- ⬜ 1.3 Several operators and aisle congestion
- ⬜ 1.4 Full flow: receive → store → pick → dispatch within deadline
- ⬜ 1.5 Operator fatigue and rest
- ⬜ 1.6 Economy — wallet separate from score — salaries, penalties, star thresholds
- ⬜ 1.7 Player actions (hire and dismiss, with arrival delay) recorded in an action
  log, the basis for replay
- ⬜ 1.8 Baseline policy and automated balance tests

## Stage 2 — Industry 4.0, locally

Goal: automation works end to end with no network.

- ⬜ 2.1 AI Analyst role and robot capacity rule
- ⬜ 2.2 Robot agent: faster, no fragile items or exceptions
- ⬜ 2.3 Battery and charging station
- ⬜ 2.4 `DecisionEngine` interface and rules engine with confidence scores
- ⬜ 2.5 Exception routing to humans and the confidence threshold control
- ⬜ 2.6 Level 1 purchase path and balance: no purchases → 1 star; guided path → 3
  stars, enforced by tests

## Stage 3 — Jev in production

Goal: real model decisions, deterministic replays, bounded cost.

- ⬜ 3.1 `packages/contracts`: shared Zod schemas for decisions, runs and rankings
- ⬜ 3.2 Scenario text corpus with true labels, versioned in the repository
- ⬜ 3.3 Decision service, queue and worker; API key only on the server
- ⬜ 3.4 Decision latency in game time and an append-only decision log (ADR)
- ⬜ 3.5 Per-item cache, spend limits and fallback (ADR)
- ⬜ 3.6 System metrics: latency percentiles, cost, cache and fallback rates
- ⬜ 3.7 Evaluation harness: rules versus Jev on accuracy, latency and cost

## Stage 4 — Accounts, progress and rankings

Goal: progress survives and rankings can be trusted.

- ⬜ 4.1 Supabase schema with versioned migrations and RLS: players, level runs,
  rankings
- ⬜ 4.2 Anonymous sessions; Google and GitHub linking that keeps progress
- ⬜ 4.3 Public nickname, moderated by Jev; never a real name or email
- ⬜ 4.4 Server-side replay validates a run, records score and stars, unlocks the next
  level
- ⬜ 4.5 Global ranking (sum of best scores) and per-level rankings
- ⬜ 4.6 First-party product events, no third-party trackers

## Stage 5 — Experience and content

Goal: the control-room experience and the full working week.

- ⬜ 5.1 Entry screen, week view (level select) and management controls
- ⬜ 5.2 Control-room panels: operation and AI system indicators, event ticker
- ⬜ 5.3 Guided level 1 and live Jev decision cards
- ⬜ 5.4 End-of-shift report: results, stars, same-day comparison, system behaviour,
  reflective message
- ⬜ 5.5 Levels 2–5 (Tuesday to Friday) as configuration, each with balance tests
- ⬜ 5.6 `/ops` console, sharing components and metrics with the in-game panels
- ⬜ 5.7 Visual identity, animation polish and a mobile fallback

## Stage 6 — Deploy and launch

Goal: a public, clickable demo and a repository that explains itself.

- ⬜ 6.1 Hosting for the static app and the long-running worker; domain; secrets
- ⬜ 6.2 Security review, performance (bundle splitting) and basic accessibility
- ⬜ 6.3 Playwright end-to-end test in CI: demo entry → level 1 at max speed → saved
  score
- ⬜ 6.4 README: problem → product → AI → architecture → engineering → numbers → demo;
  ADR index
- ⬜ 6.5 Launch: pin the repository, publish the write-up

## Decisions

Structural decisions are recorded as ADRs in `docs/decisions/`, created with the
first one. Decisions already taken in conversation and reflected above:

- Levels are configuration on a single floor plan with fixed seeds, not hand-built
  maps.
- Five levels (a working week) for the MVP; the format allows more.
- Wallet and score are separate, so investment never lowers the score.
- No username/password accounts: anonymous play plus Google or GitHub.
- Mechanical failures and workplace accidents are out of scope for now.
