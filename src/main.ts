import './style.css';
import { createViewer } from './scene';
import { createUI } from './ui';

const app = document.getElementById('app');
if (!app) throw new Error('Missing app root');

const dispose = createViewer(createUI(app));
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    dispose();
    app.replaceChildren();
  });
}
