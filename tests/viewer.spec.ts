import { expect, test } from '@playwright/test';

test.describe('iPhone Duo viewer', () => {
  test('reports an accessible initialization error instead of leaving a blank working viewer', async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (name: string, ...args: any[]) {
        if (name === 'webgl2') return null;
        return (getContext as any).call(this, name, ...args);
      } as typeof getContext;
    });
    await page.goto('/');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('WebGL 2 is required');
    await expect(page.getByRole('status')).toHaveText('Viewer unavailable. Camera controls unavailable.');
    await expect(page.getByRole('button', { name: 'Knolling' })).toBeDisabled();
    await expect(page.getByRole('slider', { name: 'Transition duration (ms)' })).toBeDisabled();
  });

  test('shows the Knolling button and the viewer canvas', async ({ page }) => {
    await page.goto('/');

    const knolling = page.getByRole('button', { name: 'Knolling' });
    await expect(knolling).toBeVisible();
    await expect(knolling).toBeEnabled();
    await expect(knolling).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Open phone', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Open phone', exact: true })).toHaveAccessibleDescription('Folding is available only in Assembled.');
    await expect(page.getByRole('banner')).toContainText('Exploded view');
    const canvas = page.getByRole('img', { name: '3D view of the exploded illustrative iPhone Duo' });
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAccessibleDescription(/Arrow keys rotate/);
    const accuracy = page.getByRole('note', { name: 'Model accuracy' });
    await expect(accuracy).toBeVisible();
    await expect(accuracy).toContainText('Illustrative 25-module model');
    await expect(accuracy).toContainText('Closed: 84.1 × 117.8 × 11.3 mm. Open: 164.6 × 117.8 × 5.2 mm.');
    await expect(accuracy).toContainText('Continuous 7.6-inch inner / 5.4-inch cover display.');
    await expect(accuracy).toContainText('not verified hardware mechanics');
  });

  test('zooms in and out and resets the view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const canvas = page.getByRole('img', { name: '3D view of the exploded illustrative iPhone Duo' });
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
    const canvas = page.getByRole('img', { name: '3D view of the exploded illustrative iPhone Duo' });
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

  test('keeps duration session-only and applies zero instantly including camera handoff without moving focus', async ({ page }) => {
    await page.goto('/');
    const slider = page.getByRole('slider', { name: 'Transition duration (ms)' });
    await slider.focus();
    await slider.press('Home');
    await expect(slider).toHaveAttribute('aria-valuetext', '0 ms');
    const knolling = page.getByRole('button', { name: 'Knolling', exact: true });
    await knolling.focus();
    await knolling.press('Space');
    await expect(knolling).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Knolling view. Camera controls available.');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Viewer help' })).toContainText('Arrow keys pan');
    await slider.focus(); await slider.press('End');
    await expect(slider).toHaveAttribute('aria-valuetext', '2000 ms');
    await page.reload();
    await expect(slider).toHaveAttribute('aria-valuetext', '600 ms');
    await expect(page.getByRole('button', { name: 'Exploded', exact: true })).toHaveAttribute('aria-pressed', 'true');
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
      for (const name of ['Zoom out', 'Zoom in', 'Reset view', 'Help', 'Assembled', 'Exploded', 'Knolling', 'Open phone']) {
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        const bounds = await button.boundingBox();
        if (!bounds) throw new Error(`${name} has no visible touch target`);
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });

    test('retains real pointer and touch orbit in both perspective modes but only pan and pinch in Knolling', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await page.evaluate(async () => {
        const load = (path: string) => import(path);
        const { PerspectiveCamera } = await load('/node_modules/three/build/three.module.js');
        const { createPhone } = await load('/src/parts.ts');
        const { createCameraControls } = await load('/src/controls.ts');
        const { createCameraCoordinator } = await load('/src/framing.ts');
        const { createTransitionController } = await load('/src/transition.ts');
        const phone = createPhone();
        const canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Camera interaction probe');
        canvas.tabIndex = 0; canvas.width = 300; canvas.height = 200;
        canvas.style.cssText = 'position:fixed;left:10px;top:100px;width:300px;height:200px;z-index:100;background:#202c38';
        document.body.append(canvas);
        const controls = createCameraControls(new PerspectiveCamera(40, 1.5, 1, 10000), canvas, 117.8);
        const coordinator = createCameraCoordinator(phone, controls, controls.orbit.object);
        coordinator.resize(1.5);
        const controller = createTransitionController(phone, coordinator);
        controller.setDuration(0);
        (window as any).__cameraProbe = {
          mode: controller.setMode,
          state: () => ({
            quaternion: coordinator.camera.quaternion.toArray(),
            target: controls.orbit.target.toArray(), zoom: coordinator.camera.zoom,
            orthographic: !!coordinator.camera.isOrthographicCamera,
          }),
          dispose() {
            controller.dispose(); coordinator.dispose(); controls.dispose(); phone.dispose(); canvas.remove();
          },
        };
      });
      const state = () => page.evaluate(() => (window as any).__cameraProbe.state());
      const mode = (value: string) => page.evaluate(value => (window as any).__cameraProbe.mode(value), value);
      const probe = page.getByRole('img', { name: 'Camera interaction probe' });
      await expect(probe).toBeVisible();
      const cdp = await page.context().newCDPSession(page);
      const touchDrag = async () => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 160 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 190 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const mouseDrag = async () => {
        await page.mouse.move(80, 160); await page.mouse.down();
        await page.mouse.move(140, 190, { steps: 5 }); await page.mouse.up();
      };
      for (const value of ['assembled', 'exploded']) {
        await mode(value);
        const initial = await state();
        await mouseDrag();
        await expect.poll(async () => (await state()).quaternion).not.toEqual(initial.quaternion);
        const afterMouse = await state();
        await touchDrag();
        await expect.poll(async () => (await state()).quaternion).not.toEqual(afterMouse.quaternion);
      }
      await mode('knolled');
      const initial = await state();
      const rotationError = (actual: number[]) => Math.max(...actual.map((v, i) => Math.abs(v - initial.quaternion[i])));
      expect(initial.orthographic).toBe(true);
      await mouseDrag();
      await expect.poll(async () => (await state()).target).not.toEqual(initial.target);
      expect(rotationError((await state()).quaternion)).toBeLessThan(1e-10);
      const afterMouse = await state();
      await touchDrag();
      await expect.poll(async () => (await state()).target).not.toEqual(afterMouse.target);
      expect(rotationError((await state()).quaternion)).toBeLessThan(1e-10);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 170 }, { x: 210, y: 170 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60, y: 170 }, { x: 240, y: 170 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(async () => (await state()).zoom).toBeGreaterThan(initial.zoom);
      expect(rotationError((await state()).quaternion)).toBeLessThan(1e-10);
      await probe.focus();
      const beforeKey = await state();
      await probe.press('ArrowUp');
      await expect.poll(async () => (await state()).target).not.toEqual(beforeKey.target);
      expect(rotationError((await state()).quaternion)).toBeLessThan(1e-10);
      await page.evaluate(() => { (window as any).__cameraProbe.dispose(); delete (window as any).__cameraProbe; });
      await cdp.detach();
    });
  });
});
