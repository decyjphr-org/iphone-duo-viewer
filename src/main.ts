// Connect UI and viewer lifecycles so hot reload tears both down together.
import './style.css';
import { createViewer } from './scene';
import { createUI } from './ui';

const app = document.getElementById('app');
if (!app) throw new Error('Missing app root');

const ui = createUI(app);
let viewer: ReturnType<typeof createViewer> | undefined;
try {
  viewer = createViewer(ui.viewer);
  ui.connect(viewer);
} catch (error) {
  ui.dispose();
  const status = app.querySelector('[role="status"]');
  if (status) status.textContent = 'Viewer unavailable. Camera controls unavailable.';
  for (const button of app.getElementsByTagName('button')) button.disabled = true;
  for (const input of app.getElementsByTagName('input')) input.disabled = true;
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'The 3D viewer could not initialize. WebGL 2 is required. Please reload in a supported browser.';
  ui.viewer.replaceChildren(message);
  console.error(error);
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ui.dispose();
    viewer?.dispose();
    app.replaceChildren();
  });
}
