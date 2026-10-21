---
applyTo: "tests/**/*.spec.ts"
---

## Playwright test requirements

- This area contains browser-level tests for the iPhone Duo viewer.
- Use TypeScript and import `test` and `expect` from `@playwright/test`.
- Keep specs under `tests/`; `viewer.spec.ts` covers the initial viewer UI.
- Group related tests inside `test.describe` with a feature name.
- Use descriptive test names that state the observable behavior.
- Use the isolated `page` fixture; keep tests independent of execution order.
- Navigate with relative URLs such as `page.goto('/')` using the configured base URL.
- Use `page.getByRole` locators with accessible names; avoid CSS selectors.
- Locate the canvas by its `img` role and accessible name.
- Assert visible state with awaited `expect(locator).toBeVisible()`, not DOM presence.
- Prefer Playwright's auto-waiting and retrying assertions over fixed sleeps.
- Mock external HTTP calls with `page.route()` before navigation or the triggering action.
- Keep smoke tests focused on visible UI; do not require pixel-perfect 3D output.
