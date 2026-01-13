import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemedStyles } from '../theme/ThemeContext';
import { savePreferences, setBlocked as persistSetBlocked } from '../storage/preferences';

const styleFactory = (colors) => StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: colors.text },
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
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { marginLeft: 12, fontSize: 16, color: colors.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.text },
  pillTextActive: { color: '#fff', fontWeight: '600' },
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
      <Text style={styles.sectionTitle}>Blocked Apps</Text>
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

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Daily Puzzle Goal</Text>
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
