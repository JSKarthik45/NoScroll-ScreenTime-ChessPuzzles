import { DefaultTheme } from '@react-navigation/native';
import { lightColors, darkColors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, color: lightColors.muted },
  body: { fontSize: 14, color: lightColors.text },
};

export const lightTheme = {
  colors: lightColors,
  spacing,
  radius,
  typography,
};

export const darkTheme = {
  colors: darkColors,
  spacing,
  radius,
  typography: {
    ...typography,
    subtitle: { ...typography.subtitle, color: darkColors.muted },
    body: { ...typography.body, color: darkColors.text },
  },
};

export const lightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.text,
    border: lightColors.border,
    primary: lightColors.primary,
  },
};

export const darkNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.text,
    border: darkColors.border,
    primary: darkColors.primary,
  },
};

export { lightColors, darkColors };
