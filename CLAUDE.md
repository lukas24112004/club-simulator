# Club Simulator

First-person 3D nightclub tycoon in the browser. Three.js + Vite + TypeScript. The owner is a beginner: explain results in plain words, keep answers short.

## Layout
- `src/core/` game rules (guests, money, upgrades, save). NO Three.js imports. Covered by `npm test`.
- `src/game/` 3D view and input. Reads from `core`, never decides rules.
- Numbers to balance: `src/core/config.ts`. Sim coords are px; 3D uses metres via `toWorld()` in `src/game/coords.ts`.

## Commands
- `npm run dev` (port 5173), `npm test`, `npm run build` (typecheck + build)

## Rules
- Run `npm test` and `npx tsc --noEmit` after changing `core`.
- Check visuals with Playwright at 960x540, only when needed. Debug handle: `window.__club` (`sim`, `app`).
- Do not commit or push unless asked. Leave the file `lool` alone.
- Free CC0 assets only (Kenney, Quaternius); keep credits in `CREDITS.md`.
