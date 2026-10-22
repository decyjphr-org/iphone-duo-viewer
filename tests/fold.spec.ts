import { expect, test } from '@playwright/test';

test.describe('P8 coordinated transitions', () => {
  test('remembers assembled folding, reports target vs settled, and toggles Knolling off to Exploded', async ({ page }) => {
    await page.goto('/');
    const status = page.getByRole('status');
    const open = page.getByRole('button', { name: 'Open phone', exact: true });
    const duration = page.getByRole('slider', { name: 'Transition duration (ms)' });
    await expect(duration).toBeVisible();
    await expect(duration).toHaveAttribute('aria-valuetext', '600 ms');
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole('button', { name: 'Assembled', exact: true }).click();
    await expect(status).toContainText('Transitioning to Assembled (closing); last settled: Exploded.');
    await expect(status).toContainText('Camera controls paused');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    await page.clock.runFor(650);
    await expect(status).toHaveText('Assembled view — closed. Camera controls available.');
    await open.click();
    await page.clock.runFor(250);
    await open.click();
    await expect(open).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toContainText('closing');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    await page.clock.runFor(650);
    await expect(status).toContainText('Assembled view — closed.');
    await open.click();
    await page.clock.runFor(650);
    await expect(status).toContainText('Assembled view — open.');
    await page.getByRole('button', { name: 'Knolling', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Knolling' })).toHaveAttribute('aria-pressed', 'true');
    await expect(open).toBeDisabled();
    await page.clock.runFor(650);
    await expect(status).toContainText('Knolling view.');
    await page.getByRole('button', { name: 'Knolling' }).click();
    await expect(page.getByRole('button', { name: 'Exploded', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.clock.runFor(650);
    await expect(status).toContainText('Exploded view.');
    await page.getByRole('button', { name: 'Assembled', exact: true }).click();
    await page.clock.runFor(650);
    await expect(status).toContainText('Assembled view — open.');
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(status).toContainText('Assembled view — open.');
  });

  test('honors initial and live reduced motion for the entire model and camera', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Knolling' }).click();
    await expect(page.getByRole('status')).toHaveText('Knolling view. Camera controls available.');
    await page.getByRole('button', { name: 'Assembled', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Assembled view — closed.');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole('button', { name: 'Knolling' }).click();
    await expect(page.getByRole('status')).toContainText('Transitioning to Knolling');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByRole('status')).toHaveText('Knolling view. Camera controls available.');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  });

  test('uses full selected elapsed duration, captures interruptions, validates input, snaps exactly and stops after disposal', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { createPhone } = await load('/src/parts.ts');
      const { createTransitionController } = await load('/src/transition.ts');
      const { partLayouts } = await load('/src/layout.ts');
      let now = 0;
      const phone = createPhone();
      let cameraProgress = 0; let cameraFinishes = 0; let cameraDuration = -1;
      const controller = createTransitionController(phone, {
        request(_mode: string, ms: number) { cameraDuration = ms; },
        update(p: number) { cameraProgress = p; },
        finish() { cameraFinishes++; cameraProgress = 1; },
      }, () => now);
      let status: any;
      controller.subscribe((value: any) => { status = value; });
      const saved = phone.parts.map((p: any) => Object.values(partLayouts(p)).map((m: any) => m.elements.slice()));
      const pose = () => [phone.flexible.angle, ...phone.flexible.skeleton.bones.flatMap((bone: any) =>
        [...bone.position.toArray(), ...bone.quaternion.toArray()]), ...phone.hinge.quaternion.toArray(), ...phone.parts.flatMap((p: any) =>
        [...p.position.toArray(), ...p.quaternion.toArray()])];
      const error = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      controller.setMode('assembled'); controller.update(300);
      const halfway = pose();
      now = 300; controller.setMode('knolled');
      const noJump = error(halfway, pose());
      controller.update(600); const middleCamera = cameraProgress;
      controller.setDuration(2000);
      controller.update(899); const notEarly = status.transitioning;
      controller.update(900); const oldDurationFinished = !status.transitioning;
      now = 900; controller.setMode('exploded');
      controller.update(2899); const full2000 = status.transitioning;
      controller.update(2900); const ended2000 = !status.transitioning;
      controller.setDuration(600);
      now = 3000; controller.setMode('assembled'); controller.update(3200);
      now = 3200; controller.toggleFold();
      const reversal = pose();
      controller.update(3799); const reversalFullDuration = status.transitioning;
      controller.update(3800); const reversalFinished = !status.transitioning;
      const openQuaternion = phone.hinge.quaternion.toArray();
      controller.setDuration(0); controller.setMode('knolled');
      phone.assembly.updateMatrixWorld(true);
      const instant = !status.transitioning && cameraDuration === 0 && cameraProgress === 1;
      const exact = phone.parts.every((p: any) => {
        p.updateMatrix();
        return error(p.matrix.elements, partLayouts(p).knolled.elements) < 1e-10;
      });
      controller.setDuration(600);
      const errors = [NaN, Infinity, -1, 2001].map(value => {
        controller.setDuration(value); return status.duration === 600 && status.error.includes('0 to 2000');
      });
      controller.setDuration(2000); now = 4000; controller.setMode('assembled');
      controller.update(4100); controller.setReducedMotion(true);
      const liveSnap = !status.transitioning && cameraProgress === 1;
      const immutable = phone.parts.every((p: any, i: number) => Object.values(partLayouts(p))
        .every((m: any, j: number) => error(m.elements, saved[i][j]) === 0));
      const before = pose();
      controller.dispose(); controller.setMode('knolled'); controller.toggleFold(); controller.update(99999);
      const disposed = error(before, pose()) === 0;
      phone.dispose();
      // Identical elapsed timestamp, different frame cadence, identical displayed poses.
      const sample = (steps: number[]) => {
        const other = createPhone();
        const c = createTransitionController(other, undefined, () => 0);
        c.setMode('knolled');
        steps.forEach(t => c.update(t));
        const out = [other.flexible.angle, ...other.flexible.skeleton.bones.flatMap((bone: any) =>
          [...bone.position.toArray(), ...bone.quaternion.toArray()]),
          ...other.parts.flatMap((p: any) => [...p.position.toArray(), ...p.quaternion.toArray()])];
        c.dispose(); other.dispose(); return out;
      };
      return { noJump, middleCamera, notEarly, oldDurationFinished, full2000, ended2000,
        reversalFullDuration, reversalFinished, openQuaternion, instant, exact, errors, liveSnap,
        immutable, disposed, reversalMoved: error(reversal, before) > 0,
        cadenceError: error(sample([300]), sample([16, 33, 100, 200, 300])), cameraFinishes };
    });
    expect(result.noJump).toBe(0);
    expect(result.middleCamera).toBe(.5);
    expect(result.openQuaternion).toEqual([-0, -1, -0, Math.cos(Math.PI / 2)]);
    expect(result.cadenceError).toBe(0);
    for (const key of ['notEarly', 'oldDurationFinished', 'full2000', 'ended2000', 'reversalFullDuration',
      'reversalFinished', 'instant', 'exact', 'liveSnap', 'immutable', 'disposed', 'reversalMoved'] as const) {
      expect(result[key], key).toBe(true);
    }
    expect(result.errors).toEqual([true, true, true, true]);
    expect(result.cameraFinishes).toBeGreaterThan(3);
  });

  test('disposes one RAF, observer, preferences, controls, UI subscriptions and shared resources exactly once', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { createUI } = await load('/src/ui.ts');
      const { createViewer } = await load('/src/scene.ts');
      const { createPhone } = await load('/src/parts.ts');
      const phone = createPhone();
      const geometries = new Set<any>(phone.parts.map((p: any) => p.geometry));
      const materials = new Set<any>(phone.parts.flatMap((p: any) => p.material));
      const counts: number[] = [];
      let skeletonDisposals = 0;
      const disposeSkeleton = phone.flexible.skeleton.dispose.bind(phone.flexible.skeleton);
      phone.flexible.skeleton.dispose = () => { skeletonDisposals++; disposeSkeleton(); };
      [...geometries, ...materials].forEach((resource, index) => {
        counts[index] = 0; resource.addEventListener('dispose', () => counts[index]++);
      });
      phone.dispose(); phone.dispose();
      const root = document.createElement('div'); document.body.append(root);
      const ui = createUI(root); ui.viewer.style.cssText = 'width:390px;height:400px';
      const request = window.requestAnimationFrame; const cancel = window.cancelAnimationFrame;
      const Observer = window.ResizeObserver; const media = window.matchMedia;
      const pending = new Set<number>();
      let disconnected = 0; let mediaAdds = 0; let mediaRemoves = 0;
      window.requestAnimationFrame = () => { pending.add(987654); return 987654; };
      window.cancelAnimationFrame = id => { pending.delete(id); };
      window.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() { disconnected++; }
      };
      window.matchMedia = (query) => {
        const value = media(query);
        const add = value.addEventListener.bind(value); const remove = value.removeEventListener.bind(value);
        value.addEventListener = (...args: any[]) => { mediaAdds++; (add as any)(...args); };
        value.removeEventListener = (...args: any[]) => { mediaRemoves++; (remove as any)(...args); };
        return value;
      };
      const viewer = createViewer(ui.viewer);
      let notifications = 0; viewer.subscribe(() => notifications++);
      ui.connect(viewer); viewer.setMode('knolled');
      const before = notifications;
      ui.dispose(); viewer.dispose(); viewer.dispose(); viewer.setMode('assembled');
      const canvasRemoved = ui.viewer.childElementCount === 0;
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      window.ResizeObserver = Observer; window.matchMedia = media;
      let unsubscribeCount = 0; let clicks = 0;
      const other = createUI(root);
      other.connect({
        zoomIn() { clicks++; }, zoomOut() {}, resetView() {}, toggleFold() {}, toggleKnolling() {},
        setMode() {}, setDuration() {},
        subscribe(listener: (status: any) => void) {
          listener({ target: 'exploded', settled: 'exploded', requestedOpen: false,
            fold: 'closed', duration: 600, error: '', cameraBusy: false, transitioning: false });
          return () => { unsubscribeCount++; };
        },
      });
      other.dispose();
      Array.from(root.getElementsByTagName('button')).filter(button => button.getAttribute('aria-label') === 'Zoom in').at(-1)?.click();
      root.remove();
      return { pending: pending.size, disconnected, mediaAdds, mediaRemoves, before, notifications,
        canvasRemoved, unsubscribeCount, clicks, counts, skeletonDisposals, geometryCount: geometries.size, materialCount: materials.size };
    });
    expect(result.pending).toBe(0);
    expect(result.disconnected).toBe(1);
    expect(result.mediaAdds).toBe(1);
    expect(result.mediaRemoves).toBe(1);
    expect(result.notifications).toBe(result.before);
    expect(result.canvasRemoved).toBe(true);
    expect(result.unsubscribeCount).toBe(1);
    expect(result.clicks).toBe(0);
    expect(result.skeletonDisposals).toBe(1);
    expect(result.geometryCount).toBeLessThan(25);
    expect(result.counts.every(count => count === 1)).toBe(true);
  });
});
