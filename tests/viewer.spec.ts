import { expect, test } from '@playwright/test';

test.describe('iPhone Duo viewer', () => {
  test('shows the Knolling button and the viewer canvas', async ({ page }) => {
    await page.goto('/');

    const knolling = page.getByRole('button', { name: 'Knolling' });
    await expect(knolling).toBeVisible();
    await expect(knolling).toBeDisabled();
    await expect(knolling).toHaveAccessibleDescription('Coming soon');
    const availability = page.getByRole('note').filter({ hasText: 'Coming soon' });
    await expect(availability).toBeVisible();
    await expect(availability).toHaveText('Coming soon');
    await expect(page.getByRole('banner')).toContainText('Closed view');
    const canvas = page.getByRole('img', { name: '3D view of the closed iPhone Duo' });
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAccessibleDescription(/Arrow keys rotate/);
  });

  test('zooms in and out and resets the view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const canvas = page.getByRole('img', { name: '3D view of the closed iPhone Duo' });
    for (const name of ['Zoom in', 'Zoom out']) {
      const initialView = await canvas.screenshot();
      await page.getByRole('button', { name, exact: true }).click();
      await expect.poll(async () => (await canvas.screenshot()).equals(initialView)).toBe(false);
      const zoomedView = await canvas.screenshot();
      await page.getByRole('button', { name: 'Reset view' }).click();
      await expect.poll(async () => (await canvas.screenshot()).equals(zoomedView)).toBe(false);
    }
  });

  test('supports focused keyboard orbit, pan, zoom, and reset', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByRole('img', { name: '3D view of the closed iPhone Duo' });
    await page.keyboard.press('Tab');
    await expect(canvas).toBeFocused();
    for (const key of ['ArrowRight', 'ArrowUp', 'Shift+ArrowUp', 'Shift+ArrowRight', 'Equal', 'Minus']) {
      const initialView = await canvas.screenshot();
      await canvas.press(key);
      await expect.poll(async () => (await canvas.screenshot()).equals(initialView)).toBe(false);
      const changedView = await canvas.screenshot();
      await canvas.press('Home');
      await expect.poll(async () => (await canvas.screenshot()).equals(changedView)).toBe(false);
    }
  });

  test('opens keyboard help and closes it with Escape', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Help', exact: true });
    const help = page.getByRole('region', { name: 'Viewer help' });

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(help).toBeVisible();
    await expect(help).toContainText('Shift + Arrow keys pan');
    await button.press('Escape');
    await expect(help).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });

  test.describe('touch controls', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test('shows touch hints and comfortably sized camera buttons', async ({ page }) => {
      await page.goto('/');
      const hint = page.getByRole('note').filter({ hasText: 'Drag to rotate' });
      await expect(hint).toBeVisible();
      await expect(hint).toHaveText(
        'Drag to rotate / Pinch to zoom / Two-finger drag to pan',
        { useInnerText: true },
      );
      for (const name of ['Zoom out', 'Zoom in', 'Reset view', 'Help']) {
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        const bounds = await button.boundingBox();
        if (!bounds) throw new Error(`${name} has no visible touch target`);
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  });
});
