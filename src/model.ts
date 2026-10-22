import { closedIPhoneDuo, openIPhoneDuo, innerDisplayDiagonalMm, coverDisplayDiagonalMm } from './specs';

export type AssemblyName = 'rear' | 'front' | 'hinge';
export type Mode = 'assembled' | 'exploded' | 'knolled';
export const modes: readonly Mode[] = ['assembled', 'exploded', 'knolled'];
export const dimensions = closedIPhoneDuo;
export const panel = {
  width: openIPhoneDuo.width / 2,
  depth: openIPhoneDuo.depth,
  gap: closedIPhoneDuo.depth - 2 * openIPhoneDuo.depth,
};
export const display = {
  height: closedIPhoneDuo.height * .92,
  width: Math.sqrt(innerDisplayDiagonalMm ** 2 - (closedIPhoneDuo.height * .92) ** 2),
  coverWidth: closedIPhoneDuo.width * .89,
  coverHeight: Math.sqrt(coverDisplayDiagonalMm ** 2 - (closedIPhoneDuo.width * .89) ** 2),
  thickness: panel.gap * .1,
};
export const bendRadius = (panel.gap + display.thickness) / 2;
// Authored proportions of the protected endpoint envelopes, NOT measured internals.
export const ratios = {
  corner: 0.095, rim: 0.035, skin: 0.055, display: 0.89,
  gap: 0.12, layer: 1.6, button: 0.025, camera: 0.125,
} as const;
type Kind = 'frame' | 'cover' | 'display' | 'support' | 'battery' | 'board'
  | 'camera' | 'speaker' | 'port' | 'button' | 'coil' | 'hinge';
export interface ModuleDefinition {
  name: string;
  assembly: AssemblyName;
  kind: Kind;
  /** Width / panel width, height / closed height, depth / twice panel depth. */
  size: readonly [number, number, number];
  /** Panel fractions; Z is relative to the inner body face (hinge: world Z). */
  center: readonly [number, number, number];
  layer: number;
  /** Full authored XYZ Euler orientation; cached as a quaternion by layout. */
  knollOrientation: readonly [number, number, number];
  broadNormal: readonly [number, number, number];
  provenance: 'authored illustrative module; endpoint envelopes and display diagonals from specs';
}
const module = (
  name: string, assembly: AssemblyName, kind: Kind,
  size: ModuleDefinition['size'], center: ModuleDefinition['center'], layer: number,
): ModuleDefinition => ({
  name, assembly, kind, size, center, layer,
  knollOrientation: [0, assembly === 'rear' && (kind === 'camera' || kind === 'cover') ? Math.PI : 0, 0],
  broadNormal: [0, 0, assembly === 'rear' && (kind === 'camera' || kind === 'cover') ? -1 : 1],
  provenance: 'authored illustrative module; endpoint envelopes and display diagonals from specs',
});
export const inventory: readonly ModuleDefinition[] = [
  module('rear-frame', 'rear', 'frame', [1, 1, .5], [0, 0, -.25], 0),
  module('rear-cover', 'rear', 'cover', [.93, .95, .055], [0, 0, -.468], -3),
  module('inner-display', 'rear', 'display', [display.width / panel.width, .92, display.thickness / (2 * panel.depth)], [-.5, 0, 0], 4),
  module('rear-display-support', 'rear', 'support', [.90, .93, .025], [0, 0, -.06], 3),
  module('rear-battery', 'rear', 'battery', [.72, .52, .20], [0, -.10, -.28], 1),
  module('logic-board', 'rear', 'board', [.65, .18, .12], [.04, .325, -.27], 2),
  module('rear-camera-wide', 'rear', 'camera', [.20, .14, .20], [-.27, .30, -.39], -4),
  module('rear-camera-ultrawide', 'rear', 'camera', [.20, .14, .20], [-.27, .12, -.39], -4),
  module('rear-speaker', 'rear', 'speaker', [.32, .065, .14], [-.22, -.40, -.28], 2),
  module('charging-port-module', 'rear', 'port', [.22, .035, .14], [.18, -.4825, -.27], 2),
  module('power-button', 'rear', 'button', [.025, .12, .15], [.4875, .15, -.25], 1),
  module('volume-rocker', 'rear', 'button', [.025, .19, .15], [.4875, -.06, -.25], 2),
  module('front-frame', 'front', 'frame', [1, 1, .5], [0, 0, .25], 0),
  module('cover-display', 'front', 'display', [display.coverWidth / panel.width, display.coverHeight / dimensions.height, .035], [0, 0, .4785], -3),
  module('front-display-support', 'front', 'support', [.90, .93, .025], [0, 0, .06], 3),
  module('front-battery', 'front', 'battery', [.72, .52, .20], [0, -.10, .28], 1),
  module('front-interconnect-board', 'front', 'board', [.65, .18, .12], [.04, .325, .27], 2),
  module('front-camera', 'front', 'camera', [.095, .065, .1], [0, .40, .35], -4),
  module('front-speaker', 'front', 'speaker', [.32, .065, .14], [-.22, -.40, .28], 2),
  module('haptic-module', 'front', 'speaker', [.24, .10, .14], [.22, -.39, .28], 2),
  module('wireless-charge-coil', 'front', 'coil', [.55, .39, .035], [0, -.10, .40], -2),
  module('side-button', 'front', 'button', [.025, .13, .15], [.4875, .15, .25], 1),
  { ...module('hinge-spine', 'hinge', 'hinge',
    [2 * (dimensions.width - panel.width) / panel.width, .93,
      (panel.depth - display.thickness * 4) / (2 * panel.depth)],
    [0, 0, -(panel.gap / 2 + panel.depth / 2) / (2 * panel.depth)], 0),
    knollOrientation: [0, Math.PI / 2, 0], broadNormal: [-1, 0, 0] },
  module('front-hinge-bracket', 'hinge', 'hinge', [.045, .12, .12],
    [.0225, .37, -(panel.gap / 2 + panel.depth / 2) / (2 * panel.depth)], 1),
  module('rear-hinge-bracket', 'hinge', 'hinge', [.045, .12, .12],
    [.0225, -.37, -(panel.gap / 2 + panel.depth / 2) / (2 * panel.depth)], 2),
];
