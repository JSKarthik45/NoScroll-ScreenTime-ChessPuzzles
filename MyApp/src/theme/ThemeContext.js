import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { setThemePrimarySecondary, lightColors, darkColors } from './colors';

function getSystemColorsSnapshot(scheme) {
  return { ...(scheme === 'dark' ? darkColors : lightColors) };
}

const ThemeContext = createContext({
  applyTheme: () => {},
  themeKey: 'classic',
  colors: lightColors,
  version: 0,
});

export function ThemeProvider({ children, initialTheme }) {
  const scheme = useColorScheme();
  const [themeKey, setThemeKey] = useState(initialTheme?.key || 'classic');
  const [version, setVersion] = useState(0); // force consumers to re-render
  const [colors, setColors] = useState(() => getSystemColorsSnapshot(scheme));

  // When OS scheme changes, switch between light/dark colors.
  useEffect(() => {
    setColors(getSystemColorsSnapshot(scheme));
    setVersion(v => v + 1);
  }, [scheme]);

  const applyTheme = useCallback((theme) => {
    if (!theme || !theme.primary || !theme.secondary) return;
    setThemePrimarySecondary(theme.primary, theme.secondary);
    setThemeKey(theme.key || 'custom');
    // capture a fresh snapshot so style recalculation hooks see new object reference
    setColors(getSystemColorsSnapshot(scheme));
    setVersion(v => v + 1); // bump to trigger context change
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ applyTheme, themeKey, version, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeController() {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  return useContext(ThemeContext).colors;
}

export function useThemedStyles(factory) {
  const { colors, version } = useThemeController();
  return React.useMemo(() => factory(colors), [colors, version, factory]);
}
