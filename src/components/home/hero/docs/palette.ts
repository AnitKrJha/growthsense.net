/**
 * Hex mirrors of the OKLCH tokens in src/styles/tokens.css. Canvas 2D and SVG-in-textures need concrete
 * colours, and older WebViews do not parse oklch() in canvas fillStyle. Keep in sync with tokens.css.
 */
export const C = {
  paper: '#fdfaf4', // --paper-50
  paperShade: '#f4efe4',
  paperLine: '#dbd3c4', // --paper-300
  paperTint: '#eee7d9', // --paper-200
  ink: '#151d18', // --graphite-900
  ink2: '#3c4540', // --graphite-700
  pencil: '#5e6561', // --graphite-500
  faint: '#9aa19c',
  forest: '#175437', // --forest-700
  forestDeep: '#0d3926', // --forest-800
  mint: '#dcf6e6', // --mint-100
  stamp: '#c93126', // --stamp-600
  carbon: '#3e559e', // --carbon-600
  carbonTint: '#e3e7f4',
} as const;
