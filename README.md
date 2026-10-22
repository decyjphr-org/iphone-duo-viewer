# iPhone Duo viewer

Minimal TypeScript, Vite, and three.js viewer. The single closed-body box measures
84.1 x 117.8 x 11.3 mm; dimensions live in `src/specs.ts`.

## Development

```sh
npm install
npm run dev
```

Drag to orbit, scroll to zoom, and right-drag to pan. On touch screens, pinch to
zoom and use two fingers to pan. The bottom controls provide Zoom out, Zoom in,
Reset view, and Help; the header identifies the current closed view.

Tab to the viewer to use Arrow keys to rotate, Shift + Arrow keys to pan,
Plus / Minus to zoom, and Home to reset. Shortcuts only apply while the viewer is focused.
Reduced-motion preferences disable orbit inertia. The Knolling toggle remains a
disabled, secondary placeholder with a visible "Coming soon" note.

```sh
npm run build
npx playwright install chromium
npm test
```

Scene setup, parts, stored layout transforms, and UI live in separate modules.
Playwright covers the placeholder's accessible availability note, camera buttons,
keyboard navigation, Help disclosure, and mobile hints and touch-target sizes.

## Playwright MCP

`.github/mcp.json` configures Playwright MCP for Copilot CLI in this repository.
It runs locally through `npx` with a headless browser and an isolated profile.
Start a new Copilot CLI session in this trusted repository to load it, then use
`/mcp` to check its status. Run `npm run dev` before asking it to inspect the viewer.
