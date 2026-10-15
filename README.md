# Shift 4.0

A warehouse shift simulator where autonomous robots, driven by a fast decision model, work
alongside human operators.

> Work in progress — milestone 0: warehouse floor plan, one operator and movement.

## Getting started

Requires Node.js 24+.

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
