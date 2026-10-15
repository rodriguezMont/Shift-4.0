# Shift 4.0

[![CI](https://github.com/rodriguezMont/Shift-4.0/actions/workflows/ci.yml/badge.svg)](https://github.com/rodriguezMont/Shift-4.0/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A human-in-the-loop AI decision system for warehouse operations, delivered as a playable
simulation: robots driven by a fast decision model work alongside human operators, and live
panels show both the operation and the AI system behind it.

> **Work in progress — Stage 1 (game core).** Read the [product one-pager](docs/product/one-pager.md)
> for the why, the [roadmap](docs/plan/ROADMAP.md) for the plan, and the
> [status](docs/plan/STATUS.md) for where things stand today.

## What works today

One level (Monday) plays as a figurative 06:00–14:00 shift on an isometric warehouse floor:

- **A planned day.** The level's seed generates the initial stock, truck arrivals and orders
  with deadlines; every box carries its true attributes.
- **Receiving.** Trucks queue for three inbound docks, back in, get unloaded box by box and
  leave. Each door has a signal (free / occupied / free me next) and a boxes-left counter.
- **Dispatch.** Operators pick stored boxes for the order due soonest and bring them to its
  outbound dock; orders ship on time, late, or are missed.
- **People.** Operators share one-wide aisles without overlapping — waiting, detouring and
  giving way — tire over the shift, walk slower when tired and take breaks.
- **Measured.** The HUD tracks orders, dock wait, time lost in aisles, energy and breaks.

Automation (robots and the decision model) starts in Stage 2.

## Getting started

Requires Node.js 24+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open http://localhost:5173 and use:

| Key           | Action                                           |
| ------------- | ------------------------------------------------ |
| `Space`       | Pause / resume                                   |
| `1`, `2`, `3` | Speed 1×, 2×, 4×                                 |
| `D`           | Switch between the 3D view and the 2D debug view |

In development only, `?operators=N` (1–12) overrides the level's team size, e.g.
http://localhost:5173/?operators=6 — production builds ignore it.

## Scripts

| Command         | What it does                                     |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Starts the web app in development mode           |
| `npm run build` | Type-checks and builds the web app               |
| `npm run check` | Type-check, lint, formatting check and all tests |
| `npm test`      | Runs the simulation test suite                   |

## Structure

- `packages/sim` — deterministic, render-agnostic simulation core (pure TypeScript, no React).
  A level file and its seed fully determine a run. Levels live in `packages/sim/levels/`.
- `apps/web` — React + react-three-fiber view. Runs the simulation at a fixed tick rate and
  interpolates between ticks for smooth rendering; it holds no game rules.
- `docs/` — product one-pager, roadmap and status.

## Continuous integration

Every pull request and every push to `main` runs `npm run check` and the production build on
GitHub Actions. Third-party actions are pinned to commit SHAs.

## License

[MIT](LICENSE) © Silvio Monteiro
