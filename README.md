# Summit Shredder

An infinite runner arcade game: snowboard down an endless slope, dodge obstacles, jump on mystery boxes for rewards, and survive as long as you can.

## Tech Stack

- **Build:** [Vite](https://vitejs.dev/)
- **3D:** [Babylon.js](https://www.babylonjs.com/)
- **Structure:** ES modules with game logic and rendering split (engine-agnostic state + Babylon renderer)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens the game at `http://localhost:5173/`.

## Build

```bash
npm run build
```

Output is in `dist/`. Serve that folder (e.g. `npx serve dist`) to run the production build.

## Testing

```bash
npm run test              # Watch mode for development
npm run test:run          # Single run (e.g. for CI)
npm run test:run:report   # Single run with HTML report at test-results/report.html
```

To view the HTML report: `npx vite preview --outDir test-results`

### GitHub CI

The `.github/workflows/test.yml` workflow runs tests on every push and pull request to `main` and `development`. It produces a JUnit report and publishes results to the PR.

To require tests to pass before merging: **Settings → Branches → Branch protection rules** for `main` and `development`, enable "Require status checks to pass" and select **Test**.

## Project Structure

- `index.html` – Entry HTML and UI layout
- `src/main.js` – Wires config, game loop, renderer, and UI
- `src/config.js` – Game configuration (physics, colors, world)
- `src/game/` – State, input, physics, obstacles, collision, particles, camera, game loop (no rendering deps)
- `src/rendering/` – Babylon.js scene and mesh creation; syncs from game state each frame
- `src/ui/` – DOM refs and event bindings

## Controls

- **Arrow Left / Right** – Steer
- **Arrow Up** – Lean forward (with steer = controlled turn)
- **Arrow Down** – Lean back (speed up) or brake (with steer)
- **Space** – Jump (tap = short, hold = charge long jump)
- **Escape** – Pause
- **Enter** – Start from menu
