import { expect, test } from '@playwright/test';

test.describe('P8 inventory, layouts and camera evidence', () => {
  test('measures nominal P9 envelopes and diagonals on one connected articulated display without frame penetration or interruption jumps', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: '3D view of the exploded illustrative iPhone Duo' })).toBeVisible();
    const evidence = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { Box3, Matrix4, Vector3 } = await load('/node_modules/three/build/three.module.js');
      const { createPhone } = await load('/src/parts.ts');
      const { createTransitionController } = await load('/src/transition.ts');
      const { display, panel, bendRadius } = await load('/src/model.ts');
      const { closedIPhoneDuo, openIPhoneDuo, innerDisplayDiagonalMm, coverDisplayDiagonalMm } = await load('/src/specs.ts');
      const phone = createPhone();
      let now = 0;
      const controller = createTransitionController(phone, undefined, () => now);
      const sheet = phone.parts.find((p: any) => p.name === 'inner-display');
      const cover = phone.parts.find((p: any) => p.name === 'cover-display');
      const identity = sheet.uuid, geometry = sheet.geometry, parent = sheet.parent;
      function vertices(part: any) {
        return Array.from({ length: part.geometry.attributes.position.count }, (_, i) =>
          part.getVertexPosition(i, new Vector3()).applyMatrix4(part.matrixWorld));
      }
      function bounds(parts: any[]) {
        phone.assembly.updateMatrixWorld(true);
        const box = new Box3();
        parts.forEach(part => vertices(part).forEach(point => box.expandByPoint(point)));
        return box;
      }
      const size = (box: any) => box.getSize(new Vector3()).toArray();
      controller.setDuration(0); controller.setMode('assembled');
      const closed = size(bounds(phone.parts));
      const closedDisplay = size(bounds([sheet]));
      controller.toggleFold();
      const open = size(bounds(phone.parts));
      const innerRectangle = size(bounds([sheet]));
      const coverRectangle = size(bounds([cover]));
      const diagonal = (rectangle: number[]) => Math.hypot(rectangle[0], rectangle[1]);
      // Connectivity is checked on the actual indexed surface, not part names.
      const count = geometry.attributes.position.count;
      const edges = Array.from({ length: count }, () => new Set<number>());
      const indices = geometry.index.array;
      for (let i = 0; i < indices.length; i += 3) {
        for (let j = 0; j < 3; j++) {
          const a = indices[i + j], b = indices[i + (j + 1) % 3];
          edges[a].add(b); edges[b].add(a);
        }
      }
      const visited = new Set<number>(), pending = [0];
      while (pending.length) {
        const index = pending.pop()!;
        if (visited.has(index)) continue;
        visited.add(index); edges[index].forEach(other => pending.push(other));
      }
      let maxJump = 0, maxFollowingError = 0, maxArcError = 0, maxLengthError = 0, penetrations = 0, samples = 0;
      let minThickness = Infinity, maxThickness = 0;
      const pose = () => {
        phone.assembly.updateMatrixWorld(true);
        return vertices(sheet).flatMap(point => point.toArray());
      };
      const difference = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      function sample() {
        phone.assembly.updateMatrixWorld(true);
        const points = vertices(sheet);
        const phi = phone.flexible.angle;
        const halfBend = phi * bendRadius / 2;
        const inverse = new Matrix4();
        const frames = phone.parts.filter((p: any) => p.userData.definition.kind === 'frame');
        // Probe vertices and triangle-edge interiors against all three actual
        // solid U-rim rails, in each moving frame's local coordinates.
        const probes = points.slice();
        for (let i = 0; i < indices.length; i += 3) {
          const a = points[indices[i]], b = points[indices[i + 1]], c = points[indices[i + 2]];
          for (const f of [.25, .5, .75]) {
            probes.push(a.clone().lerp(b, f), b.clone().lerp(c, f), c.clone().lerp(a, f));
          }
        }
        frames.forEach((frame: any) => {
          inverse.copy(frame.matrixWorld).invert();
          // Each merged geometry group is an actual solid box rail. Measure
          // those vertices rather than repeating the authored recess formula.
          const rails = frame.geometry.groups.map((group: any) => {
            const box = new Box3();
            for (let i = group.start; i < group.start + group.count; i++) {
              box.expandByPoint(new Vector3().fromBufferAttribute(frame.geometry.attributes.position, i));
            }
            return box;
          });
          probes.forEach(point => {
            const p = point.clone().applyMatrix4(inverse);
            if (rails.some((box: any) => ['x', 'y', 'z'].every(axis =>
              p[axis] > box.min[axis] + 1e-5 && p[axis] < box.max[axis] - 1e-5))) penetrations++;
          });
        });
        // Mid-surface material coordinates follow each body's inner plane.
        const frontInverse = new Matrix4().copy(phone.hinge.children[0].matrixWorld).invert();
        let length = 0;
        let previous: any;
        for (let column = 0; column < count / 4; column++) {
          const s = geometry.attributes.position.getX(column * 4);
          const mid = points[column * 4].clone().add(points[column * 4 + 3]).multiplyScalar(.5);
          if (previous) length += mid.distanceTo(previous);
          previous = mid.clone();
          if (s > halfBend + 1e-5) maxFollowingError = Math.max(maxFollowingError, Math.abs(mid.z + bendRadius));
          else if (s < -halfBend - 1e-5) {
            mid.applyMatrix4(frontInverse);
            maxFollowingError = Math.max(maxFollowingError, Math.abs(mid.z - bendRadius));
          } else {
            mid.x += panel.width / 2;
            maxArcError = Math.max(maxArcError, Math.abs(Math.hypot(mid.x, mid.z) - bendRadius));
          }
          const thickness = points[column * 4].distanceTo(points[column * 4 + 3]);
          minThickness = Math.min(minThickness, thickness); maxThickness = Math.max(maxThickness, thickness);
        }
        maxLengthError = Math.max(maxLengthError, Math.abs(length - display.width));
        samples++;
      }
      controller.setDuration(600);
      function request(action: () => void) {
        const before = pose(); action(); controller.update(now);
        maxJump = Math.max(maxJump, difference(before, pose()));
      }
      function advance(ms: number) {
        for (let elapsed = 0; elapsed <= ms; elapsed += 10) { controller.update(now + elapsed); sample(); }
        now += ms;
      }
      request(() => controller.toggleFold()); advance(230);
      request(() => controller.toggleFold()); advance(370);
      request(() => controller.toggleFold()); advance(600);
      request(() => controller.toggleFold()); advance(600);
      // Mode interruptions retain exactly the displayed deformed surface.
      const beforeMode = pose(); controller.setMode('knolled'); controller.update(now);
      maxJump = Math.max(maxJump, difference(beforeMode, pose()));
      controller.update(now + 210); now += 210;
      const beforeReturn = pose(); controller.setMode('assembled'); controller.update(now);
      maxJump = Math.max(maxJump, difference(beforeReturn, pose()));
      controller.setReducedMotion(true);
      const reducedExact = phone.flexible.angle === 0;
      controller.setReducedMotion(false); controller.setDuration(0); controller.toggleFold();
      const zeroExact = phone.flexible.angle === Math.PI;
      const stable = identity === sheet.uuid && geometry === sheet.geometry && parent === sheet.parent;
      const cellEntries = phone.parts.filter((p: any) => p.name === 'inner-display').length;
      controller.dispose(); phone.dispose();
      return { closed, open, closedDisplay, innerRectangle, coverRectangle,
        expectedClosed: Object.values(closedIPhoneDuo), expectedOpen: Object.values(openIPhoneDuo),
        innerDiagonal: diagonal(innerRectangle), coverDiagonal: diagonal(coverRectangle),
        innerDisplayDiagonalMm, coverDisplayDiagonalMm, connected: visited.size === count,
        indexedVertices: count, maxJump, maxFollowingError, maxArcError, maxLengthError, penetrations, samples,
        minThickness, maxThickness, expectedThickness: display.thickness,
        closedSheetDepth: panel.gap + 2 * display.thickness, stable, cellEntries, reducedExact, zeroExact };
    });
    console.log('P9 actual-vertex articulation evidence', JSON.stringify(evidence));
    for (const [actual, expected] of [[evidence.closed, evidence.expectedClosed], [evidence.open, evidence.expectedOpen]]) {
      actual.forEach((value: number, i: number) => expect(Math.abs(value - expected[i])).toBeLessThan(1e-4));
    }
    expect(Math.abs(evidence.innerDiagonal - evidence.innerDisplayDiagonalMm)).toBeLessThan(.01);
    expect(Math.abs(evidence.coverDiagonal - evidence.coverDisplayDiagonalMm)).toBeLessThan(.01);
    // The specified neutral radius (gap + thickness)/2 seats each sheet in
    // a thickness-deep recess; its inner faces bound the 0.9 mm body gap.
    expect(evidence.closedDisplay[2]).toBeCloseTo(evidence.closedSheetDepth, 6);
    expect(evidence.connected && evidence.stable && evidence.reducedExact && evidence.zeroExact).toBe(true);
    expect(evidence.cellEntries).toBe(1);
    expect(evidence.maxJump).toBeLessThan(1e-8);
    expect(evidence.maxFollowingError).toBeLessThan(1e-5);
    expect(evidence.maxArcError).toBeLessThan(1e-5);
    expect(evidence.maxLengthError).toBeLessThan(.001);
    expect(evidence.penetrations).toBe(0);
    expect(evidence.minThickness).toBeCloseTo(evidence.expectedThickness, 6);
    expect(evidence.maxThickness).toBeCloseTo(evidence.expectedThickness, 6);
  });

  test('matches projection scale, captures interrupted camera poses and restores aspect-adjusted Exploded intent', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { PerspectiveCamera, Vector3 } = await load('/node_modules/three/build/three.module.js');
      const { createPhone } = await load('/src/parts.ts');
      const { createCameraControls } = await load('/src/controls.ts');
      const { createCameraCoordinator } = await load('/src/framing.ts');
      const { createTransitionController } = await load('/src/transition.ts');
      const phone = createPhone();
      const canvas = document.createElement('canvas'); document.body.append(canvas);
      const controls = createCameraControls(new PerspectiveCamera(40, 1, 1, 10000), canvas, 117.8);
      const coordinator = createCameraCoordinator(phone, controls, controls.orbit.object);
      coordinator.resize(2);
      let now = 0;
      const controller = createTransitionController(phone, coordinator, () => now);
      const pose = () => [...coordinator.camera.position.toArray(), ...coordinator.camera.quaternion.toArray()];
      const error = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      const project = () => {
        coordinator.camera.updateMatrixWorld(); coordinator.camera.updateProjectionMatrix();
        const target = controls.orbit.target;
        return target.clone().add(new Vector3(20, 20, 0)).project(coordinator.camera).toArray().slice(0, 2);
      };
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      controls.update(); // Leave perspective inertia pending at camera acquisition.
      const savedPosition = coordinator.camera.position.clone();
      const savedTarget = controls.orbit.target.clone();
      const beforeRequest = pose();
      controller.setMode('knolled');
      const pendingDampingCaptureError = error(beforeRequest, pose());
      controller.update(200);
      const interrupted = pose();
      now = 200; controller.setMode('exploded');
      const noJump = error(interrupted, pose());
      controller.update(800); now = 800;
      // Endpoint plane scale immediately before/after perspective -> ortho.
      coordinator.request('knolled', 600, now); coordinator.update(1);
      const before = project(); coordinator.finish(); const after = project();
      const entryScaleError = error(before, after);
      controls.zoomIn(); controls.update();
      const beforeExit = project();
      coordinator.request('exploded', 600, now);
      const exitScaleError = error(beforeExit, project());
      coordinator.update(.4);
      const beforeResize = pose();
      coordinator.resize(.75); coordinator.update(.4);
      const cameraResizeError = error(beforeResize, pose());
      const mid = pose(); coordinator.request('knolled', 600, now);
      const cameraReversalError = error(mid, pose());
      coordinator.finish();
      coordinator.resize(.5);
      coordinator.request('exploded', 0, now); coordinator.finish();
      const expected = savedPosition.clone().sub(savedTarget).multiplyScalar(2).add(savedTarget);
      const aspectRestoreError = coordinator.camera.position.distanceTo(expected);
      const targetError = controls.orbit.target.distanceTo(savedTarget);
      const beforeResizeDirection = coordinator.camera.position.clone().sub(controls.orbit.target).normalize();
      coordinator.resize(1);
      const resizeDirectionError = coordinator.camera.position.clone().sub(controls.orbit.target).normalize().distanceTo(beforeResizeDirection);
      coordinator.resize(0); coordinator.updateClipping();
      const finite = [...pose(), coordinator.camera.near, coordinator.camera.far,
        controls.orbit.minDistance, controls.orbit.maxDistance, controls.orbit.minZoom, controls.orbit.maxZoom].every(Number.isFinite);
      const planes = coordinator.camera.near > 0 && coordinator.camera.far > coordinator.camera.near;
      const cachedExploded = pose();
      controller.setDuration(0); controller.setMode('assembled');
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      controls.update();
      controller.setMode('knolled'); controller.setMode('exploded');
      const assembledDoesNotOverwriteExploded = error(cachedExploded, pose());
      controller.dispose(); coordinator.dispose(); controls.dispose();
      const disposedPose = pose();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      controls.zoomIn(); controls.update();
      const stopped = error(disposedPose, pose()) === 0;
      canvas.remove(); phone.dispose();
      return { noJump, pendingDampingCaptureError, entryScaleError, exitScaleError, cameraReversalError, cameraResizeError, aspectRestoreError,
        targetError, resizeDirectionError, assembledDoesNotOverwriteExploded, finite, planes, stopped };
    });
    console.log('P8 projection/resize evidence', result);
    for (const key of ['noJump', 'pendingDampingCaptureError', 'entryScaleError', 'exitScaleError', 'cameraReversalError', 'cameraResizeError',
      'aspectRestoreError', 'targetError', 'resizeDirectionError', 'assembledDoesNotOverwriteExploded'] as const) expect(result[key], key).toBeLessThan(1e-8);
    expect(result.finite && result.planes && result.stopped).toBe(true);
  });

  test('has exactly 25 modules, independent parent-aware snapshots and a flat positive-gap 6-column grid', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const { Box3, Quaternion, Vector3 } = await load('/node_modules/three/build/three.module.js');
      const { createPhone } = await load('/src/parts.ts');
      const { createTransitionController } = await load('/src/transition.ts');
      const { dimensions } = await load('/src/model.ts');
      const phone = createPhone();
      const parents = phone.parts.map((p: any) => p.parent);
      const saved = phone.parts.map((p: any) => Object.values(p.userData.layouts).map((m: any) => m.elements.slice()));
      const independent = phone.parts.every((p: any) => new Set([...Object.values(p.userData.layouts), p.matrix]).size === 4);
      const controller = createTransitionController(phone); controller.setDuration(0);
      controller.setMode('assembled'); phone.assembly.updateMatrixWorld(true);
      const closed = new Box3().setFromObject(phone.assembly, true).getSize(new Vector3()).toArray();
      const perMode = ['assembled', 'exploded', 'knolled'].map(mode => {
        controller.setMode(mode); phone.assembly.updateMatrixWorld(true);
        return phone.parts.every((p: any) => {
          p.updateMatrix();
          return p.matrix.elements.every((v: number, i: number) => Math.abs(v - p.userData.layouts[mode].elements[i]) < 1e-10);
        });
      });
      const boxes = phone.parts.map((p: any) => new Box3().setFromObject(p, true));
      const normalError = Math.max(...phone.parts.map((p: any) => {
        const normal = new Vector3(...p.userData.definition.broadNormal).applyQuaternion(p.getWorldQuaternion(new Quaternion()));
        return Math.abs(1 - normal.z);
      }));
      let minGap = Infinity; let overlaps = 0; let centerError = 0; let planeError = 0;
      boxes.forEach((box: any, i: number) => {
        const center = box.getCenter(new Vector3());
        centerError = Math.max(centerError,
          Math.abs(center.x - (i % 6 - 2.5) * phone.layouts.cellWidth),
          Math.abs(center.y - (2 - Math.floor(i / 6)) * phone.layouts.cellHeight));
        planeError = Math.max(planeError, Math.abs(center.z));
        boxes.slice(i + 1).forEach((other: any) => {
          const xgap = Math.max(box.min.x - other.max.x, other.min.x - box.max.x);
          const ygap = Math.max(box.min.y - other.max.y, other.min.y - box.max.y);
          if (xgap <= 0 && ygap <= 0) overlaps++;
          minGap = Math.min(minGap, Math.max(xgap, ygap));
        });
      });
      const geometries = phone.parts.map((p: any) => p.geometry);
      for (let i = 0; i < 10; i++) {
        controller.setMode('exploded'); controller.setMode('assembled'); controller.toggleFold(); controller.setMode('knolled');
      }
      const immutable = phone.parts.every((p: any, i: number) => Object.values(p.userData.layouts)
        .every((m: any, j: number) => m.elements.every((v: number, k: number) => v === saved[i][j][k])));
      const stable = phone.parts.every((p: any, i: number) => p.parent === parents[i] && p.geometry === geometries[i]);
      const names = phone.parts.map((p: any) => p.name);
      let meshCount = 0; phone.assembly.traverse((o: any) => { if (o.isMesh) meshCount++; });
      const membership = phone.parts.map((p: any) => [p.userData.definition.assembly, p.parent.name]);
      const provenance = phone.parts.every((p: any) => p.userData.definition.provenance.includes('authored'));
      controller.dispose(); phone.dispose();
      return { names, meshCount, independent, perMode, minGap, gap: phone.layouts.gap, overlaps,
        centerError, planeError, normalError, immutable, stable, closed, dimensions, membership, provenance };
    });
    expect(result.names).toEqual([
      'rear-frame', 'rear-cover', 'inner-display', 'rear-display-support', 'rear-battery',
      'logic-board', 'rear-camera-wide', 'rear-camera-ultrawide', 'rear-speaker', 'charging-port-module',
      'power-button', 'volume-rocker', 'front-frame', 'cover-display',
      'front-display-support', 'front-battery', 'front-interconnect-board', 'front-camera', 'front-speaker',
      'haptic-module', 'wireless-charge-coil', 'side-button', 'hinge-spine', 'front-hinge-bracket', 'rear-hinge-bracket',
    ]);
    expect(new Set(result.names).size).toBe(25);
    expect(result.meshCount).toBe(25);
    expect(result.perMode).toEqual([true, true, true]);
    expect(result.overlaps).toBe(0);
    expect(result.minGap).toBeGreaterThanOrEqual(result.gap - 1e-5);
    expect(result.centerError).toBeLessThan(1e-5);
    expect(result.planeError).toBeLessThan(1e-5);
    expect(result.normalError).toBeLessThan(1e-10);
    expect(result.independent && result.immutable && result.stable && result.provenance).toBe(true);
    result.membership.forEach(([assembly, parent]: string[]) => expect(parent).toBe(`${assembly}-assembly`));
    [result.dimensions.width, result.dimensions.height, result.dimensions.depth].forEach((value, index) =>
      expect(result.closed[index]).toBeCloseTo(value, 4));
    console.log('P8 grid evidence', JSON.stringify(result));
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`keeps rear and near-opposing camera handoffs continuous through interruption and resize at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const canvas = page.getByRole('img', { name: '3D view of the exploded illustrative iPhone Duo' });
      await expect(canvas).toBeVisible();
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('No viewport');
      const evidence = await page.evaluate(async ({ width, height }) => {
        const load = (path: string) => import(path);
        const { PerspectiveCamera, Vector3 } = await load('/node_modules/three/build/three.module.js');
        const { createPhone } = await load('/src/parts.ts');
        const { createCameraControls } = await load('/src/controls.ts');
        const { createCameraCoordinator } = await load('/src/framing.ts');
        const { createTransitionController } = await load('/src/transition.ts');
        const { dimensions } = await load('/src/model.ts');
        const results = [];
        for (const direction of [[0, 0, -1], [1e-6, .02, -1], [-1e-6, -.02, -1]]) {
          for (const duration of [600, 2000]) {
            const phone = createPhone();
            const element = document.createElement('canvas'); document.body.append(element);
            const perspective = new PerspectiveCamera(40, width / height, 1, 10000);
            const controls = createCameraControls(perspective, element, dimensions.height);
            const coordinator = createCameraCoordinator(phone, controls, perspective);
            const aspect = width / height; coordinator.resize(aspect);
            let now = 0;
            const controller = createTransitionController(phone, coordinator, () => now);
            controller.setDuration(duration);
            let status: any; controller.subscribe((value: any) => { status = value; });
            const sourceDistance = perspective.position.distanceTo(controls.orbit.target);
            const sourceTarget = controls.orbit.target.clone().add(new Vector3(dimensions.width * .03, -dimensions.height * .02, 0));
            const sourcePosition = new Vector3(...direction).normalize().multiplyScalar(sourceDistance).add(sourceTarget);
            controls.setPose(sourcePosition, sourceTarget);
            const pose = () => [...coordinator.camera.position.toArray(), ...coordinator.camera.quaternion.toArray(), ...controls.orbit.target.toArray()];
            const error = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
            let minDistance = Infinity; let maxDistance = 0; let maxAngle = 0; let maxRotationStep = 0;
            let maxNDC = 0; let minZ = Infinity; let maxZ = -Infinity; let maxJump = 0;
            let finite = true; let durationHeld = true; let samples = 0; let geometrySamples = 0;
            const ray = new Vector3();
            let previousRay = sourcePosition.clone().sub(sourceTarget).normalize();
            const previousRotation = coordinator.camera.quaternion.clone();
            const point = new Vector3();
            function sample(geometry: boolean) {
              ray.copy(coordinator.camera.position).sub(controls.orbit.target);
              const distance = ray.length();
              minDistance = Math.min(minDistance, distance); maxDistance = Math.max(maxDistance, distance);
              ray.normalize();
              maxAngle = Math.max(maxAngle, Math.acos(Math.max(-1, Math.min(1, previousRay.dot(ray)))));
              maxRotationStep = Math.max(maxRotationStep, previousRotation.angleTo(coordinator.camera.quaternion));
              previousRay.copy(ray);
              previousRotation.copy(coordinator.camera.quaternion);
              finite &&= [...pose(), distance].every(Number.isFinite);
              samples++;
              if (!geometry) return;
              coordinator.updateClipping(); coordinator.camera.updateMatrixWorld();
              phone.assembly.updateMatrixWorld(true);
              for (const part of phone.parts) {
                const positions = part.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                  part.getVertexPosition(i, point).applyMatrix4(part.matrixWorld).project(coordinator.camera);
                  finite &&= Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
                  maxNDC = Math.max(maxNDC, Math.abs(point.x), Math.abs(point.y));
                  minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
                }
              }
              geometrySamples++;
            }
            function run(mode: string, fraction = 1, resizeFraction = -1, nextAspect = aspect) {
              const before = pose(); controller.setMode(mode); controller.update(now);
              maxJump = Math.max(maxJump, error(before, pose()));
              const times = Array.from({ length: 121 }, (_, i) => duration * fraction * i / 120);
              if (fraction === 1) times.push(duration - 1);
              times.sort((a, b) => a - b);
              let resized = false;
              times.forEach((elapsed, i) => {
                controller.update(now + elapsed); controls.update();
                sample(i % 10 === 0 || i === times.length - 1);
                if (resizeFraction >= 0 && !resized && elapsed >= duration * resizeFraction) {
                  const captured = pose();
                  coordinator.resize(nextAspect); controller.update(now + elapsed);
                  maxJump = Math.max(maxJump, error(captured, pose())); resized = true;
                }
                if (elapsed < duration) durationHeld &&= status.transitioning && status.cameraBusy;
              });
              now += duration * fraction;
              if (fraction === 1) durationHeld &&= !status.transitioning && !status.cameraBusy;
            }
            sample(true);
            run('knolled'); run('exploded');
            run('knolled', .36, .18, aspect * .8);
            run('exploded', .41, .20, aspect * .9);
            run('knolled', 1, .5, aspect * .7);
            run('exploded', 1, .5, aspect);
            const returnError = Math.max(coordinator.camera.position.distanceTo(sourcePosition),
              controls.orbit.target.distanceTo(sourceTarget));
            controller.setDuration(0); controller.setMode('knolled');
            const instant = !status.transitioning && coordinator.camera.isOrthographicCamera;
            controller.setMode('exploded');
            const instantReturnError = coordinator.camera.position.distanceTo(sourcePosition);
            controller.setDuration(duration); controller.setMode('knolled'); controller.update(now + duration / 3);
            controller.setReducedMotion(true);
            const reducedSnap = !status.transitioning && !status.cameraBusy && coordinator.camera.isOrthographicCamera;
            results.push({ direction, duration, sourceDistance, minDistance, maxDistance, maxAngle, maxRotationStep, maxNDC, minZ, maxZ,
              maxJump, finite, durationHeld, samples, geometrySamples, returnError, instant, instantReturnError, reducedSnap });
            controller.dispose(); coordinator.dispose(); controls.dispose(); phone.dispose(); element.remove();
          }
        }
        return results;
      }, bounds);
      console.log(`P8 opposing-view evidence ${viewport.width}x${viewport.height}`, JSON.stringify(evidence));
      for (const result of evidence) {
        expect(result.finite && result.durationHeld && result.instant && result.reducedSnap).toBe(true);
        expect(result.minDistance).toBeGreaterThanOrEqual(result.sourceDistance - 1e-8);
        expect(result.maxDistance).toBeLessThan(result.sourceDistance * 20);
        expect(result.maxAngle).toBeLessThan(.15);
        expect(result.maxRotationStep).toBeLessThan(.15);
        expect(result.maxJump).toBeLessThan(1e-8);
        expect(result.returnError).toBeLessThan(1e-8);
        expect(result.instantReturnError).toBeLessThan(1e-8);
        expect(result.maxNDC).toBeLessThan(1);
        expect(result.minZ).toBeGreaterThan(-1);
        expect(result.maxZ).toBeLessThan(1);
      }
    });

    test(`contains actual geometry throughout folds/layouts and coordinates cameras at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const canvas = page.getByRole('img', { name: '3D view of the exploded illustrative iPhone Duo' });
      await expect(canvas).toBeVisible();
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('No viewport');
      const result = await page.evaluate(async ({ width, height }) => {
        const load = (path: string) => import(path);
        const { PerspectiveCamera, Vector3 } = await load('/node_modules/three/build/three.module.js');
        const { createPhone } = await load('/src/parts.ts');
        const { createTransitionController } = await load('/src/transition.ts');
        const { createCameraControls } = await load('/src/controls.ts');
        const { createCameraCoordinator } = await load('/src/framing.ts');
        const phone = createPhone();
        const element = document.createElement('canvas');
        element.width = width; element.height = height; document.body.append(element);
        const perspective = new PerspectiveCamera(40, width / height, .1, 100000);
        const controls = createCameraControls(perspective, element, 117.8);
        const coordinator = createCameraCoordinator(phone, controls, perspective);
        coordinator.resize(width / height);
        let now = 0;
        const controller = createTransitionController(phone, coordinator, () => now);
        let maxNDC = 0; let minZ = Infinity; let maxZ = -Infinity; let samples = 0;
        const sample = () => {
          phone.assembly.updateMatrixWorld(true);
          coordinator.camera.updateMatrixWorld();
          coordinator.updateClipping();
          phone.parts.forEach((part: any) => {
            const positions = part.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              const point = part.getVertexPosition(i, new Vector3()).applyMatrix4(part.matrixWorld).project(coordinator.camera);
              maxNDC = Math.max(maxNDC, Math.abs(point.x), Math.abs(point.y));
              minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
            }
          });
          samples++;
        };
        sample();
        for (const mode of ['assembled', 'exploded', 'knolled', 'exploded', 'assembled']) {
          controller.setMode(mode);
          for (let i = 0; i <= 24; i++) { controller.update(now + i * 25); sample(); }
          now += 600;
          if (mode === 'assembled') {
            controller.toggleFold();
            for (let i = 0; i <= 60; i++) { controller.update(now + i * 10); sample(); }
            now += 600;
          }
        }
        // Fold reversal -> mode interruption -> resize -> assembled return.
        // Sample the actual deformed sheet, not its undeformed attributes.
        const capture = () => {
          phone.assembly.updateMatrixWorld(true);
          return [...coordinator.camera.position.toArray(), ...coordinator.camera.quaternion.toArray(),
            ...phone.parts.flatMap((part: any) => Array.from({ length: part.geometry.attributes.position.count },
              (_, i) => part.getVertexPosition(i, new Vector3()).applyMatrix4(part.matrixWorld).toArray()).flat())];
        };
        let mixedJump = 0;
        const interrupt = (action: () => void) => {
          const before = capture(); action(); controller.update(now);
          const after = capture();
          mixedJump = before.reduce((max, v, i) => Math.max(max, Math.abs(v - after[i])), mixedJump);
        };
        const advance = (ms: number) => {
          for (let t = 0; t <= ms; t += 10) { controller.update(now + t); sample(); }
          now += ms;
        };
        interrupt(() => controller.toggleFold()); advance(180);
        interrupt(() => controller.toggleFold()); advance(120);
        interrupt(() => controller.setMode('knolled')); advance(200);
        interrupt(() => coordinator.resize(width / height * .8)); advance(100);
        interrupt(() => controller.setMode('assembled')); advance(600);
        interrupt(() => controller.toggleFold()); advance(250);
        coordinator.resize(width / height); sample(); advance(350);
        controller.setDuration(0); controller.setMode('exploded');
        const cameraPose = () => [...coordinator.camera.position.toArray(), ...coordinator.camera.quaternion.toArray(),
          ...controls.orbit.target.toArray()];
        const error = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
        const home = cameraPose();
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        controls.update(); const orbitMoved = error(home, cameraPose());
        controls.resetView(); controls.update(); const resetError = error(home, cameraPose());
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
        controls.update();
        // Flush pending damping before obtaining the cached user camera.
        controls.setSuspended(true); controls.setSuspended(false);
        const saved = cameraPose();
        controller.setMode('knolled');
        const ortho = coordinator.camera;
        const orientation = ortho.quaternion.toArray();
        const gridPose = cameraPose();
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        controls.update();
        const gridPan = error(gridPose, cameraPose());
        const gridRotationError = error(orientation, ortho.quaternion.toArray());
        const zoomBefore = ortho.zoom; controls.zoomIn(); controls.update();
        const gridZoom = Math.abs(ortho.zoom - zoomBefore);
        controls.resetView(); controls.update();
        const gridResetError = error(gridPose, cameraPose());
        const type = ortho.isOrthographicCamera;
        const rotateEnabled = controls.orbit.enableRotate;
        controller.setMode('exploded'); controls.update();
        const returnError = error(saved, cameraPose());
        coordinator.resize(0); const finite = cameraPose().every(Number.isFinite);
        controller.dispose(); coordinator.dispose(); controls.dispose(); phone.dispose(); element.remove();
        return { maxNDC, minZ, maxZ, samples, mixedJump, orbitMoved, resetError, gridPan,
          gridRotationError, gridZoom, gridResetError, type, rotateEnabled, returnError, finite };
      }, bounds);
      console.log(`P8 frustum ${viewport.width}x${viewport.height}`, JSON.stringify(result));
      expect(result.maxNDC).toBeLessThan(1);
      expect(result.minZ).toBeGreaterThan(-1);
      expect(result.maxZ).toBeLessThan(1);
      expect(result.mixedJump).toBeLessThan(1e-8);
      expect(result.orbitMoved).toBeGreaterThan(1);
      expect(result.resetError).toBeLessThan(1e-8);
      expect(result.gridPan).toBeGreaterThan(1);
      expect(result.gridRotationError).toBeLessThan(1e-10);
      expect(result.gridZoom).toBeGreaterThan(0);
      expect(result.gridResetError).toBeLessThan(1e-8);
      expect(result.type).toBe(true);
      expect(result.rotateEnabled).toBe(false);
      expect(result.returnError).toBeLessThan(1e-8);
      expect(result.finite).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }
});
