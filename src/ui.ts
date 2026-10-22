import type { ViewerActions } from './scene';

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
  viewStatus.textContent = 'Closed view';
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
  knolling.disabled = true;
  knolling.setAttribute('aria-pressed', 'false');
  knolling.setAttribute('aria-describedby', 'knolling-availability');
  const availability = document.createElement('small');
  availability.id = 'knolling-availability';
  availability.setAttribute('role', 'note');
  availability.textContent = 'Coming soon';
  knollingControl.append(knolling, availability);
  const foldButton = createButton('Open phone');
  foldButton.setAttribute('aria-pressed', 'false');
  const schematic = document.createElement('p');
  schematic.className = 'interaction-hint';
  schematic.textContent = 'Schematic book fold — not verified hardware geometry.';

  panel.append(cameraActions, hint, help, foldButton, schematic, knollingControl);
  main.append(viewer, panel);
  root.append(header, main);

  let unsubscribeFold: (() => void) | undefined;
  return {
    viewer,
    connect(actions: ViewerActions) {
      zoomIn.addEventListener('click', actions.zoomIn, { signal });
      zoomOut.addEventListener('click', actions.zoomOut, { signal });
      resetView.addEventListener('click', actions.resetView, { signal });
      foldButton.addEventListener('click', actions.toggleFold, { signal });
      unsubscribeFold?.();
      unsubscribeFold = actions.subscribeFold(({ state, requestedOpen }) => {
        foldButton.setAttribute('aria-pressed', String(requestedOpen));
        viewStatus.textContent = {
          closed: 'Closed view', opening: 'Opening phone…',
          open: 'Open view', closing: 'Closing phone…',
        }[state];
      });
    },
    dispose() {
      listeners.abort();
      unsubscribeFold?.();
    },
  };
}
