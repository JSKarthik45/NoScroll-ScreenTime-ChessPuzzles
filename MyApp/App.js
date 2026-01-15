import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import { OnboardingContext } from './src/navigation/OnboardingContext';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { loadPreferences } from './src/storage/preferences';
import { setThemePrimarySecondary } from './src/theme/colors';
import { ThemeProvider, useThemeColors, useThemeController } from './src/theme/ThemeContext';

import getPuzzlesData from './src/services/getData';

// Toggle to force showing onboarding in development
// Set to true during development to always see onboarding
const SHOW_ONBOARDING_ALWAYS = false;

const ONBOARDING_KEY = 'hasOnboarded';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  // In dev, start in onboarding even if stored as completed,
  // but allow switching to app after finishing within the session.
  const [devSessionOnboarding, setDevSessionOnboarding] = useState(SHOW_ONBOARDING_ALWAYS);

  const [initialTheme, setInitialTheme] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasOnboarded(value === 'true');
        const prefs = await loadPreferences();
        if (prefs.theme) {
          setThemePrimarySecondary(prefs.theme.primary, prefs.theme.secondary);
          setInitialTheme(prefs.theme);
        }
      } catch (e) {
        setHasOnboarded(false);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) {
    // While loading preferences/onboarding flag, rely on the native Expo splash.
    return null;
  }

  // In development, start with onboarding but allow exit on completion
  const showOnboarding = devSessionOnboarding ? true : !hasOnboarded;

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } finally {
      setHasOnboarded(true);
      // End dev-only onboarding for this session so app shows after completion
      setDevSessionOnboarding(false);
    }
  };

  // Build a navigation theme each render after provider mounts so primary/secondary update.
  const ThemedNav = () => {
    const colors = useThemeColors();
    const navTheme = {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border || DefaultTheme.colors.border,
        notification: colors.primary,
      },
    };
    return (
      <NavigationContainer theme={navTheme}>
        {showOnboarding ? <OnboardingNavigator /> : <AppNavigator />}
      </NavigationContainer>
    );
  };

  return (
    <OnboardingContext.Provider value={{ completeOnboarding }}>
      <ThemeProvider initialTheme={initialTheme}>
        <ThemedNav />
      </ThemeProvider>
    </OnboardingContext.Provider>
  );
}

// Onboarding completion is handled through OnboardingContext
