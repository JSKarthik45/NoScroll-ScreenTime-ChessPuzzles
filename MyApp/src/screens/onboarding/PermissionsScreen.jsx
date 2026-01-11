import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CircleButton from '../../components/CircleButton';
import { OnboardingContext } from '../../navigation/OnboardingContext';
import { useThemeColors } from '../../theme/ThemeContext';

export default function PermissionsScreen() {
  const { completeOnboarding } = useContext(OnboardingContext);
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Permissions</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Explain required app permissions here.</Text>

      <CircleButton
        onPress={completeOnboarding}
        icon="checkmark"
        backgroundColor={colors.success}
        style={styles.fab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { marginTop: 8 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
});
