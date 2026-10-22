// Physical dimensions are in millimeters.
export const closedIPhoneDuo = {
  width: 84.1,
  height: 117.8,
  depth: 11.3,
} as const;

export const openIPhoneDuo = {
  width: 164.6,
  height: 117.8,
  depth: 5.2,
} as const;

export const mmPerInch = 25.4;

// Display diagonals are specified in inches and converted to scene millimeters.
export const innerDisplayDiagonalInches = 7.6;
export const coverDisplayDiagonalInches = 5.4;
export const innerDisplayDiagonalMm = innerDisplayDiagonalInches * mmPerInch;
export const coverDisplayDiagonalMm = coverDisplayDiagonalInches * mmPerInch;
