import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import { OnboardingContext } from './src/navigation/OnboardingContext';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { loadPreferences } from './src/storage/preferences';
import { setThemePrimarySecondary } from './src/theme/colors';
import { ThemeProvider, useThemeColors } from './src/theme/ThemeContext';

// Development toggle: set to true to skip onboarding while testing.
const DEV_SKIP_ONBOARDING = false;

const ONBOARDING_KEY = 'hasOnboarded';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const skipOnboardingForTesting = __DEV__ && DEV_SKIP_ONBOARDING;

  const [initialTheme, setInitialTheme] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        const onboarded = value === 'true';
        setHasOnboarded(onboarded);
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

  const showOnboarding = skipOnboardingForTesting ? false : !hasOnboarded;

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } finally {
      setHasOnboarded(true);
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
