export const palette = {
  primary: '#739552',
  primaryDark: '#739552',
  secondary: '#ebecd0',
  background: '#ffffffff',
  surface: '#ddddddff',
  text: '#0f172a',
  muted: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#e5e7eb',
};

export const lightColors = {
  primary: palette.primary,
  secondary: palette.secondary,
  background: palette.background,
  surface: palette.surface,
  text: palette.text,
  muted: palette.muted,
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  border: palette.border,
};

export const darkColors = {
  primary: palette.primary,
  secondary: palette.secondary,
  background: '#000000ff',
  surface: '#383838ff',
  text: '#e5e7eb',
  muted: '#9ca3af',
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  border: '#1f2937',
};

// Chessboard constants (frame, pieces, highlights). Square colors come from `palette` so
// they follow the user-selected theme (primary/secondary) but not the OS scheme.
const chessBoardFixed = {
  frame: '#383838ff',
  pieceWhite: '#f0f0f0',
  pieceBlack: '#101010',
  highlight: '#5792ebff',
  moveDot: '#5792ebff',
};

// Runtime setter to allow dynamic theme switching for primary/secondary.
export function setThemePrimarySecondary(primary, secondary) {
  if (primary) {
    palette.primary = primary;
    palette.primaryDark = primary;
    lightColors.primary = primary;
    darkColors.primary = primary;
  }
  if (secondary) {
    palette.secondary = secondary;
    lightColors.secondary = secondary;
    darkColors.secondary = secondary;
  }
}

export function getChessBoardColors() {
  return {
    darkSquare: palette.primary,
    lightSquare: palette.secondary,
    frame: chessBoardFixed.frame,
    border: palette.background,
    pieceWhite: chessBoardFixed.pieceWhite,
    pieceBlack: chessBoardFixed.pieceBlack,
    highlight: chessBoardFixed.highlight,
    moveDot: chessBoardFixed.moveDot,
  };
}
