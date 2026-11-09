# Club Simulator

Run a neon nightclub you can walk around in. Guests arrive, pay at the door, queue at the bar, dance and leave. Spend the money on upgrades to earn more.

Built with [Three.js](https://threejs.org), Vite and TypeScript. Runs in the browser.

## Play it locally

```
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173) and click to enter.

| Key | Action |
|---|---|
| W A S D | Walk |
| Mouse | Look around |
| Shift | Run |
| M | Switch between walking and the manager's bird's-eye view |
| 1 / 2 | Buy upgrades (or click the cards in manager view) |
| N | Mute the music |
| Esc | Pause |

Progress saves automatically in your browser. "Reset progress" (bottom left) starts over.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the game with live reload |
| `npm test` | Run the rule tests |
| `npm run build` | Typecheck and build to `dist/` |

## How the code is organised

- `src/core/` holds the rules: guests, money, upgrades, saving. It has **no 3D code**, so it is easy to test.
- `src/game/` holds the 3D club, the people, the light show, the controls, the music and the HUD. It only reads from `core`.
- `src/core/config.ts` holds every number you might want to balance (prices, speeds, upgrade costs).

## Roadmap

1. ~~A small club, guests walking in, money coming in~~ (done, now in 3D)
2. A shop with more upgrades and visible changes
3. DJs and music
4. Location upgrades
5. Events, polish
