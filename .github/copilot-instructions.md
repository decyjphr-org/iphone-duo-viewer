# iPhone Duo knolling viewer

Interactive 3D viewer for the iPhone Duo with an exploded view and a knolling mode.

## Stack
- TypeScript, Vite, and three.js. No UI framework.
- npm for package management.

## Commands
- `npm run dev`: start the dev server
- `npm run build`: type-check and build
- `npm test`: run the Playwright tests

## Conventions
- Scene units are millimeters.
- One mesh per physical component. Name every mesh after its part (for example, `inner-display`).
- Read all dimensions from `src/specs.ts`. No magic numbers.
- Keep modules small: scene setup, parts, layout (exploded and knolling), and UI.
