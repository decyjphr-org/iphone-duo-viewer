export function createUI(root: HTMLElement): HTMLElement {
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'iPhone Duo';
  const knolling = document.createElement('button');
  knolling.type = 'button';
  knolling.textContent = 'Knolling';
  knolling.setAttribute('aria-pressed', 'false');
  knolling.title = 'Knolling mode is not implemented yet';
  header.append(title, knolling);

  const viewer = document.createElement('main');
  viewer.setAttribute('aria-label', 'Phone viewer');
  root.append(header, viewer);
  return viewer;
}
