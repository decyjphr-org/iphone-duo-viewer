// Connect UI and viewer lifecycles so hot reload tears both down together.
import './style.css';
import { createViewer } from './scene';
import { createUI } from './ui';

const app = document.getElementById('app');
if (!app) throw new Error('Missing app root');

const ui = createUI(app);
const viewer = createViewer(ui.viewer);
ui.connect(viewer);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ui.dispose();
    viewer.dispose();
    app.replaceChildren();
  });
}
