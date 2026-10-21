# iPhone Duo viewer

Minimal TypeScript, Vite, and three.js viewer. The single closed-body box measures
84.1 x 117.8 x 11.3 mm; dimensions live in `src/specs.ts`.

## Development

```sh
npm install
npm run dev
```

Drag to orbit, scroll to zoom, and right-drag to pan. The Knolling toggle is a
placeholder and intentionally does nothing.

```sh
npm run build
npx playwright install chromium
npm test
```

Scene setup, parts, stored layout transforms, and UI live in separate modules.
The Playwright smoke test checks that the Knolling button and canvas are visible.
