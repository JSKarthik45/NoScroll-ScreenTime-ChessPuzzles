import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemedStyles } from '../theme/ThemeContext';
import { savePreferences, setBlocked as persistSetBlocked } from '../storage/preferences';

const styleFactory = (colors) => StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { marginLeft: 12, fontSize: 16, color: colors.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  helperText: { marginTop: 1, color: colors.muted },
});

export default function SettingsQuickSetup({ blocked, setBlocked, problemTarget, setProblemTarget }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);
  const [localBlocked, setLocalBlocked] = useState(blocked || {});

  // keep local state in sync with parent when onboarding passes updated blocked
  useEffect(() => {
    setLocalBlocked(blocked || {});
  }, [blocked]);

  const toggleApp = (key) => {
    const next = { ...(localBlocked || {}), [key]: !(localBlocked || {})[key] };
    setLocalBlocked(next);
    // fire-and-forget persistence so UI feels instant
    try { persistSetBlocked(next); } catch {}
    if (setBlocked) {
      try { setBlocked(next); } catch {}
    }
  };

  const SOCIAL_APPS = [
    { key: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
    { key: 'twitter', label: 'Twitter', icon: 'logo-twitter' },
    { key: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
    { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
    { key: 'reddit', label: 'Reddit', icon: 'logo-reddit' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
    { key: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat' },
  ];

  const BRAND_COLORS = {
    facebook: '#1877F2',
    twitter: '#1DA1F2',
    instagram: '#E1306C',
    youtube: '#FF0000',
    reddit: '#FF4500',
    whatsapp: '#25D366',
    snapchat: '#FFFC00',
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Ionicons name="shield-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Blocked Apps</Text>
      </View>
      {SOCIAL_APPS.map((item) => {
        const isOn = !!(localBlocked && localBlocked[item.key]);
        return (
          <View key={item.key} style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name={item.icon} size={28} color={BRAND_COLORS[item.key] || colors.text} />
              <Text style={styles.rowLabel}>{item.label}</Text>
            </View>
            <Switch
              value={isOn}
              onValueChange={() => toggleApp(item.key)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
        );
      })}

      <View style={[styles.sectionHeader, { marginTop: 16 }]}>
        <Ionicons name="extension-puzzle-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Daily Puzzle Goal</Text>
      </View>
      <View style={styles.pillRow}>
        {[1, 3, 5, 10, 20].map(n => {
          const active = problemTarget === n;
          return (
            <Pressable key={n} onPress={async () => { setProblemTarget(n); await savePreferences({ problemTarget: n }); }} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
