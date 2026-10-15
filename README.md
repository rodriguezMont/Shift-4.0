# Shift 4.0

[![CI](https://github.com/rodriguezMont/Shift-4.0/actions/workflows/ci.yml/badge.svg)](https://github.com/rodriguezMont/Shift-4.0/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A human-in-the-loop AI decision system for warehouse operations, delivered as a playable
simulation: robots driven by a fast decision model work alongside human operators, and live
panels show both the operation and the AI system behind it.

> Work in progress — Stage 0 (foundation) is done. See the
> [product one-pager](docs/product/one-pager.md), the [roadmap](docs/plan/ROADMAP.md) and the
> [current status](docs/plan/STATUS.md).

## Getting started

Requires Node.js 24+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

Press `D` in the app to switch between the isometric 3D view and the 2D debug view.

## Scripts

| Command         | What it does                                     |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Starts the web app in development mode           |
| `npm run build` | Type-checks and builds the web app               |
| `npm run check` | Type-check, lint, formatting check and all tests |
| `npm test`      | Runs the simulation test suite                   |

## Structure

- `packages/sim` — deterministic, render-agnostic simulation core (pure TypeScript, no React).
  A seed fully determines a run.
- `apps/web` — React + react-three-fiber view. Runs the simulation at a fixed tick rate and
  interpolates between ticks for smooth rendering.

## Continuous integration

Every pull request and every push to `main` runs `npm run check` and the production build on
GitHub Actions. Third-party actions are pinned to commit SHAs.

## License

[MIT](LICENSE) © Silvio Monteiro
