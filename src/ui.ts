import type { ViewerActions } from './scene';
import { dimensions } from './model';
import { openIPhoneDuo, innerDisplayDiagonalInches, coverDisplayDiagonalInches } from './specs';

function createButton(label: string, text = label): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  if (text !== label) button.setAttribute('aria-label', label);
  return button;
}

export function createUI(root: HTMLElement) {
  const listeners = new AbortController();
  const { signal } = listeners;
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'iPhone Duo';
  const viewStatus = document.createElement('p');
  viewStatus.className = 'view-status';
  viewStatus.textContent = 'Exploded view';
  viewStatus.setAttribute('role', 'status');
  viewStatus.setAttribute('aria-live', 'polite');
  header.append(title, viewStatus);

  const main = document.createElement('main');
  main.setAttribute('aria-label', 'Phone viewer');
  const viewer = document.createElement('div');
  viewer.className = 'viewer-viewport';
  const panel = document.createElement('section');
  panel.className = 'viewer-tools';
  panel.setAttribute('aria-label', 'Viewer controls');

  const cameraActions = document.createElement('div');
  cameraActions.className = 'camera-actions';
  cameraActions.setAttribute('role', 'group');
  cameraActions.setAttribute('aria-label', 'Camera actions');
  const zoomOut = createButton('Zoom out', '-');
  const zoomIn = createButton('Zoom in', '+');
  const resetView = createButton('Reset view');
  const helpButton = createButton('Help');
  helpButton.setAttribute('aria-expanded', 'false');
  helpButton.setAttribute('aria-controls', 'viewer-help');
  cameraActions.append(zoomOut, zoomIn, resetView, helpButton);

  const hint = document.createElement('p');
  hint.className = 'interaction-hint';
  hint.id = 'viewer-interaction-hint';
  hint.setAttribute('role', 'note');
  const pointerHint = document.createElement('span');
  pointerHint.className = 'pointer-hint';
  pointerHint.textContent = 'Drag to rotate / Scroll to zoom / Right-drag to pan';
  const touchHint = document.createElement('span');
  touchHint.className = 'touch-hint';
  touchHint.textContent = 'Drag to rotate / Pinch to zoom / Two-finger drag to pan';
  hint.append(pointerHint, touchHint);

  const help = document.createElement('div');
  help.id = 'viewer-help';
  help.className = 'viewer-help';
  help.hidden = true;
  help.setAttribute('role', 'region');
  help.setAttribute('aria-label', 'Viewer help');
  const keyboardHelp = document.createElement('p');
  keyboardHelp.id = 'viewer-keyboard-help';
  keyboardHelp.textContent =
    'Focus the viewer: Arrow keys rotate; Shift + Arrow keys pan; + / - zoom; Home resets.';
  const focusHelp = document.createElement('p');
  focusHelp.textContent =
    'Use Tab to reach the viewer or camera buttons. Press Escape here to close help.';
  help.append(keyboardHelp, focusHelp);

  function closeHelp() {
    help.hidden = true;
    helpButton.setAttribute('aria-expanded', 'false');
  }
  helpButton.addEventListener(
    'click',
    () => {
      help.hidden = !help.hidden;
      helpButton.setAttribute('aria-expanded', String(!help.hidden));
    },
    { signal },
  );
  panel.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || help.hidden) return;
      event.preventDefault();
      closeHelp();
      helpButton.focus();
    },
    { signal },
  );

  const knollingControl = document.createElement('div');
  knollingControl.className = 'knolling-control';
  const knolling = createButton('Knolling');
  knolling.setAttribute('aria-pressed', 'false');
  const assembled = createButton('Assembled');
  const exploded = createButton('Exploded');
  assembled.setAttribute('aria-pressed', 'false');
  exploded.setAttribute('aria-pressed', 'true');
  knollingControl.setAttribute('role', 'group');
  knollingControl.setAttribute('aria-label', 'Layout mode');
  knollingControl.append(assembled, exploded, knolling);
  const foldButton = createButton('Open phone');
  foldButton.setAttribute('aria-pressed', 'false');
  foldButton.setAttribute('aria-describedby', 'fold-availability');
  const availability = document.createElement('small');
  availability.id = 'fold-availability';
  availability.textContent = 'Folding is available only in Assembled.';
  const durationRow = document.createElement('div');
  durationRow.className = 'duration-control';
  const durationLabel = document.createElement('label');
  durationLabel.htmlFor = 'transition-duration';
  durationLabel.textContent = 'Transition duration (ms)';
  const duration = document.createElement('input');
  duration.id = 'transition-duration';
  duration.type = 'range'; duration.min = '0'; duration.max = '2000';
  duration.step = '1'; duration.value = '600';
  const durationValue = document.createElement('span');
  durationValue.className = 'duration-value';
  // The slider already exposes these units via aria-valuetext. Avoid another
  // implicit live region (HTML output has role=status).
  durationValue.setAttribute('aria-hidden', 'true');
  durationValue.textContent = '600 ms';
  duration.setAttribute('aria-valuetext', '600 ms');
  durationRow.append(durationLabel, duration, durationValue);
  const schematic = document.createElement('p');
  schematic.className = 'interaction-hint';
  schematic.setAttribute('role', 'note');
  schematic.setAttribute('aria-label', 'Model accuracy');
  schematic.textContent = 'Illustrative 25-module model — not a teardown or full BOM. '
    + `Closed: ${dimensions.width} × ${dimensions.height} × ${dimensions.depth} mm. `
    + `Open: ${openIPhoneDuo.width} × ${openIPhoneDuo.height} × ${openIPhoneDuo.depth} mm. `
    + `Continuous ${innerDisplayDiagonalInches}-inch inner / ${coverDisplayDiagonalInches}-inch cover display. `
    + 'Internal shapes and finite-radius sliding display attachment are illustrative, not verified hardware mechanics.';

  panel.append(knollingControl, durationRow, cameraActions, hint, help, foldButton, availability, schematic);
  main.append(viewer, panel);
  root.append(header, main);

  let unsubscribe: (() => void) | undefined;
  let connection: AbortController | undefined;
  return {
    viewer,
    connect(actions: ViewerActions) {
      connection?.abort();
      connection = new AbortController();
      const connected = { signal: connection.signal };
      zoomIn.addEventListener('click', actions.zoomIn, connected);
      zoomOut.addEventListener('click', actions.zoomOut, connected);
      resetView.addEventListener('click', actions.resetView, connected);
      foldButton.addEventListener('click', actions.toggleFold, connected);
      assembled.addEventListener('click', () => actions.setMode('assembled'), connected);
      exploded.addEventListener('click', () => actions.setMode('exploded'), connected);
      knolling.addEventListener('click', actions.toggleKnolling, connected);
      duration.addEventListener('input', () => actions.setDuration(duration.valueAsNumber), connected);
      unsubscribe?.();
      unsubscribe = actions.subscribe(({ target, settled, transitioning, requestedOpen, fold, duration: ms, error, cameraBusy }) => {
        foldButton.setAttribute('aria-pressed', String(requestedOpen));
        foldButton.disabled = target !== 'assembled';
        assembled.setAttribute('aria-pressed', String(target === 'assembled'));
        exploded.setAttribute('aria-pressed', String(target === 'exploded'));
        knolling.setAttribute('aria-pressed', String(target === 'knolled'));
        for (const button of [zoomIn, zoomOut, resetView]) {
          button.disabled = cameraBusy;
        }
        duration.value = String(ms);
        durationValue.textContent = `${ms} ms`;
        duration.setAttribute('aria-valuetext', `${ms} ms`);
        const labels = { assembled: 'Assembled', exploded: 'Exploded', knolled: 'Knolling' };
        viewStatus.textContent = (transitioning
          ? `Transitioning to ${labels[target]}${target === 'assembled' ? ` (${fold})` : ''}; last settled: ${labels[settled]}.`
          : `${labels[settled]} view${target === 'assembled' ? ` — ${fold}` : ''}.`)
          + (cameraBusy ? ' Camera controls paused during handoff; restored on completion.' : ' Camera controls available.')
          + (error ? ` ${error}` : '');
        const grid = target === 'knolled';
        pointerHint.textContent = grid
          ? 'Drag to pan / Scroll to zoom / Rotation locked in Knolling'
          : 'Drag to rotate / Scroll to zoom / Right-drag to pan';
        touchHint.textContent = grid
          ? 'Drag to pan / Pinch to zoom / Rotation locked in Knolling'
          : 'Drag to rotate / Pinch to zoom / Two-finger drag to pan';
        keyboardHelp.textContent = grid
          ? 'Focus the viewer: Arrow keys pan; + / - zoom; Home resets. Rotation is locked in Knolling.'
          : 'Focus the viewer: Arrow keys rotate; Shift + Arrow keys pan; + / - zoom; Home resets.';
      });
    },
    dispose() {
      listeners.abort();
      connection?.abort();
      unsubscribe?.();
    },
  };
}
