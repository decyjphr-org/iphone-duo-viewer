import { expect, test } from '@playwright/test';

test.describe('schematic book fold', () => {
  test('reverses while opening, keeps camera actions available, and announces endpoints', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Open phone', exact: true });
    const status = page.getByRole('status');
    await expect(button).toBeVisible();
    await expect(page.getByText('Schematic book fold — not verified hardware geometry.')).toBeVisible();
    await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
    await button.click();
    await expect(status).toHaveText('Opening phone…');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toBeEnabled();
    await page.clock.runFor(250);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await button.click();
    await expect(status).toHaveText('Closing phone…');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await page.clock.runFor(650);
    await expect(status).toHaveText('Closed view');
    await button.click();
    await page.clock.runFor(650);
    await expect(status).toHaveText('Open view');
    await expect(page.getByRole('img', { name: '3D view of the open schematic iPhone Duo' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(status).toHaveText('Open view');
    await expect(page.getByRole('button', { name: 'Knolling' })).toBeDisabled();
  });

  test('honors initial and live reduced-motion preferences', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Open phone', exact: true });
    await button.click();
    await expect(page.getByRole('status')).toHaveText('Open view');
    await button.click();
    await expect(page.getByRole('status')).toHaveText('Closed view');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
    await button.click();
    await expect(page.getByRole('status')).toHaveText('Opening phone…');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByRole('status')).toHaveText('Open view');
  });

  test('has exact geometry endpoints, continuous time-based reversal, immutable snapshots, and shared disposal', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { createPhone } = await load('/src/parts.ts');
      const { createFoldController } = await load('/src/fold.ts');
      const { closedIPhoneDuo: specs } = await load('/src/specs.ts');
      const { Box3, Vector3 } = await load('/node_modules/three/build/three.module.js');
      const phone = createPhone();
      const front = phone.assembly.getObjectByName('front-panel');
      const rear = phone.assembly.getObjectByName('rear-panel');
      const saved = front.userData.layouts.exploded.elements.slice();
      const independent = front.userData.layouts.exploded !== front.userData.layouts.knolled
        && front.userData.layouts.exploded !== front.matrix;
      const closed = new Box3().setFromObject(phone.assembly);
      const fold = createFoldController(phone.hinge);
      let state = '';
      fold.subscribeFold((value: { state: string }) => { state = value.state; });
      fold.toggleFold();
      const now = performance.now();
      fold.update(now + 300);
      const halfway = phone.hinge.rotation.y;
      fold.toggleFold();
      const reversalStart = phone.hinge.rotation.y;
      fold.update(performance.now() + 150);
      const reversing = phone.hinge.rotation.y;
      fold.update(performance.now() + 601);
      const closedAngle = phone.hinge.rotation.y;
      fold.toggleFold();
      fold.update(performance.now() + 601);
      phone.assembly.updateMatrixWorld(true);
      const openCenter = front.getWorldPosition(new Vector3()).toArray();
      const openAngle = phone.hinge.rotation.y;
      const frontBounds = new Box3().setFromObject(front);
      const rearBounds = new Box3().setFromObject(rear);
      const unchanged = saved.every((v: number, i: number) =>
        v === front.userData.layouts.exploded.elements[i]
        && v === front.userData.layouts.knolled.elements[i]);
      let geometryDisposals = 0;
      let materialDisposals = 0;
      front.geometry.addEventListener('dispose', () => geometryDisposals++);
      front.material.addEventListener('dispose', () => materialDisposals++);
      fold.dispose();
      fold.toggleFold();
      fold.update(performance.now() + 1000);
      const stopped = phone.hinge.rotation.y === openAngle && state === 'open';
      const shared = front.geometry === rear.geometry && front.material === rear.material;
      phone.dispose();
      return {
        specs, independent, unchanged, closed: closed.getSize(new Vector3()).toArray(),
        halfway, reversalStart, reversing, closedAngle, openAngle, openCenter,
        separated: frontBounds.max.x <= rearBounds.min.x + 1e-10,
        shared, geometryDisposals, materialDisposals, stopped,
      };
    });
    // BoxGeometry stores vertices as Float32; transforms/end angles remain doubles.
    [result.specs.width, result.specs.height, result.specs.depth].forEach((value, index) => {
      expect(result.closed[index]).toBeCloseTo(value, 4);
    });
    expect(result.halfway).toBeCloseTo(-Math.PI / 2, 1);
    expect(result.reversalStart).toBe(result.halfway);
    expect(result.reversing).toBeGreaterThan(result.reversalStart);
    expect(result.reversing).toBeLessThan(0);
    expect(result.closedAngle).toBeCloseTo(0, 12);
    expect(result.openAngle).toBe(-Math.PI);
    expect(result.openCenter[0]).toBeCloseTo(-result.specs.width, 10);
    expect(result.openCenter[1]).toBe(0);
    expect(result.openCenter[2]).toBeCloseTo(-result.specs.depth / 4, 10);
    for (const key of ['independent', 'unchanged', 'separated', 'shared', 'stopped'] as const) {
      expect(result[key], key).toBe(true);
    }
    expect(result.geometryDisposals).toBe(1);
    expect(result.materialDisposals).toBe(1);
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`numerically frames the full sweep and resets pending damping at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const canvas = page.getByRole('img', { name: '3D view of the closed iPhone Duo' });
      await expect(canvas).toBeVisible();
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Missing canvas bounds');
      const result = await page.evaluate(async ({ width, height }) => {
        const load = (path: string) => import(path);
        const { PerspectiveCamera, Vector3 } = await load('/node_modules/three/build/three.module.js');
        const { getHomeFrame, sweepRadius } = await load('/src/framing.ts');
        const { createPhone } = await load('/src/parts.ts');
        const { createCameraControls } = await load('/src/controls.ts');
        const { closedIPhoneDuo: specs } = await load('/src/specs.ts');
        const camera = new PerspectiveCamera(40, width / height, specs.height / 100, specs.height * 100);
        const home = getHomeFrame(camera);
        const element = document.createElement('canvas');
        document.body.append(element);
        const controls = createCameraControls(camera, element, specs.height);
        controls.setHome(home.position, home.target, home.distance, true);
        camera.updateMatrixWorld();
        const pose = [...camera.position.toArray(), ...camera.quaternion.toArray()];
        const phone = createPhone();
        let maxProjected = 0;
        let minDepth = Infinity;
        let maxDepth = -Infinity;
        for (let step = 0; step <= 180; step++) {
          phone.hinge.rotation.y = -Math.PI * step / 180;
          phone.assembly.updateMatrixWorld(true);
          for (const name of ['front-panel', 'rear-panel']) {
            const part = phone.assembly.getObjectByName(name);
            const positions = part.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              const world = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
              const projected = world.clone().project(camera);
              maxProjected = Math.max(maxProjected, Math.abs(projected.x), Math.abs(projected.y));
              minDepth = Math.min(minDepth, projected.z);
              maxDepth = Math.max(maxDepth, projected.z);
            }
          }
        }
        // Keyboard input leaves orbit and pan damping pending before reset.
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
        controls.zoomIn();
        controls.update();
        const moved = camera.position.distanceTo(home.position);
        controls.resetView();
        for (let i = 0; i < 10; i++) controls.update();
        const after = [...camera.position.toArray(), ...camera.quaternion.toArray()];
        const resetError = Math.max(...after.map((v: number, i: number) => Math.abs(v - pose[i])));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        controls.update();
        const resizePose = camera.position.clone();
        camera.aspect /= 2;
        const resized = getHomeFrame(camera);
        controls.setHome(resized.position, resized.target, resized.distance, false);
        const resizeUnchanged = camera.position.distanceTo(resizePose);
        controls.resetView();
        const resizedResetError = camera.position.distanceTo(resized.position);
        camera.aspect *= 2;
        const restored = getHomeFrame(camera);
        controls.setHome(restored.position, restored.target, restored.distance, false);
        const atHomeResizeError = camera.position.distanceTo(restored.position);
        controls.dispose();
        element.remove();
        phone.dispose();
        return { maxProjected, minDepth, maxDepth, resetError, moved, resizeUnchanged,
          resizedResetError, atHomeResizeError, distance: home.distance, sweepRadius };
      }, bounds);
      expect(result.maxProjected).toBeLessThan(1);
      expect(result.minDepth).toBeGreaterThan(-1);
      expect(result.maxDepth).toBeLessThan(1);
      expect(result.distance).toBeGreaterThan(result.sweepRadius);
      expect(result.moved).toBeGreaterThan(1);
      expect(result.resetError).toBeLessThan(1e-10);
      expect(result.resizeUnchanged).toBe(0);
      expect(result.resizedResetError).toBeLessThan(1e-10);
      expect(result.atHomeResizeError).toBeLessThan(1e-10);
      await page.getByRole('button', { name: 'Open phone', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Open view');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }

  test('disposes a transitioning viewer and disconnects UI subscriptions and listeners', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { createUI } = await load('/src/ui.ts');
      const { createViewer } = await load('/src/scene.ts');
      const root = document.createElement('div');
      document.body.append(root);
      const ui = createUI(root);
      ui.viewer.style.cssText = 'width:390px;height:400px';
      const request = window.requestAnimationFrame;
      const cancel = window.cancelAnimationFrame;
      const frames = new Set<number>();
      window.requestAnimationFrame = (callback) => {
        const id = request(callback);
        frames.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => { frames.delete(id); cancel(id); };
      const viewer = createViewer(ui.viewer);
      let notifications = 0;
      viewer.subscribeFold(() => notifications++);
      ui.connect(viewer);
      viewer.toggleFold();
      const before = notifications;
      ui.dispose();
      viewer.dispose();
      viewer.toggleFold();
      const remainingFrames = frames.size;
      window.requestAnimationFrame = request;
      window.cancelAnimationFrame = cancel;
      const canvasRemoved = ui.viewer.childElementCount === 0;
      // UI disposal independently unsubscribes, even if the viewer remains alive.
      let unsubscribeCount = 0;
      let clicks = 0;
      const other = createUI(root);
      other.connect({
        zoomIn() { clicks++; }, zoomOut() {}, resetView() {}, toggleFold() {},
        subscribeFold(listener: (status: { state: string; requestedOpen: boolean }) => void) {
          listener({ state: 'closed', requestedOpen: false });
          return () => { unsubscribeCount++; };
        },
      });
      other.dispose();
      const zoom = Array.from(root.getElementsByTagName('button')).filter(
        (button) => button.getAttribute('aria-label') === 'Zoom in',
      ).at(-1);
      zoom?.click();
      root.remove();
      return { remainingFrames, canvasRemoved, before, notifications, unsubscribeCount, clicks };
    });
    expect(result.remainingFrames).toBe(0);
    expect(result.canvasRemoved).toBe(true);
    expect(result.notifications).toBe(result.before);
    expect(result.unsubscribeCount).toBe(1);
    expect(result.clicks).toBe(0);
  });
});
