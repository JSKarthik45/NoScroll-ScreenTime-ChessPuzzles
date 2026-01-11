import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CircleButton from '../../components/CircleButton';
import { useThemeColors } from '../../theme/ThemeContext';

export default function WelcomeScreen({ navigation }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Welcome</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Onboarding starts here.</Text>

      <CircleButton
        onPress={() => navigation.navigate('Permissions')}
        icon="arrow-forward"
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
