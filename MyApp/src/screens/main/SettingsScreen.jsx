import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Linking, Switch, NativeModules, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, useThemeColors } from '../../theme/ThemeContext';
import { loadPreferences, savePreferences, setTheme, setChessUsername as saveChessUsername, setChessTacticsRating, clearChessImport, setBlocked as persistSetBlocked, getBlockedUntoggleCount, setBlockedUntoggleCount, onTacticsRatingChanged } from '../../storage/preferences';
import { useThemeController } from '../../theme/ThemeContext';

const { PermissionModule } = NativeModules || {};

// No app toggles; replaced by time window selection UI

const styleFactory = (colors) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 0 },
  scrollContent: { paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 8 },
  sectionSubtitle: { fontSize: 13, color: colors.muted, marginBottom: 8, marginLeft: 28 },
  listContent: { paddingVertical: 3 },
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
  helperText: { marginTop: 6, color: colors.muted },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  primaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  input: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  linkLabel: { marginLeft: 12, fontSize: 16, color: colors.text, flex: 1 },
  linkIconRight: { marginLeft: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    width: '48%',
    marginRight: 0,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  themeOptionActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.background },
  themeSwatches: { flexDirection: 'row', marginRight: 8 },
  swatch: { width: 22, height: 22, borderRadius: 6, marginRight: 4 },
  themeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, opacity: 0.5, marginVertical: 16 },
});

export default function SettingsScreen() {
  const [blocked, setBlocked] = useState({});
  const [blockedUntoggleCount, setBlockedUntoggleCountState] = useState(0);
  const [problemTarget, setProblemTarget] = useState(5);
  const [chessUsername, setChessUsername] = useState('');
  const [themeKey, setThemeKey] = useState('classic');
  const [tacticsRating, setTacticsRating] = useState(null);
  const [importing, setImporting] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const themeController = useThemeController();
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);
  const MAX_UNTOGGLES = 3;
  const remainingUntoggles = Math.max(0, MAX_UNTOGGLES - (blockedUntoggleCount || 0));

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      const pref = await loadPreferences();
      setBlocked(pref.blocked || {}); // legacy
      setProblemTarget(pref.problemTarget ?? 5);
      // no-scroll window removed; only blocked apps and problemTarget persisted
      if (pref.theme) {
        setThemeKey(pref.theme.key || 'classic');
      }
      if (pref.chessUsername) setChessUsername(pref.chessUsername);
      if (pref.chessTacticsRating != null) setTacticsRating(pref.chessTacticsRating);

      // Load how many times the user has already un-blocked apps
      const storedUntoggles = await getBlockedUntoggleCount();
      setBlockedUntoggleCountState(typeof storedUntoggles === 'number' && Number.isFinite(storedUntoggles) ? storedUntoggles : 0);

      // Check if monitoring is currently active
      if (Platform.OS === 'android' && PermissionModule && typeof PermissionModule.isBlockingEnabled === 'function') {
        try {
          const enabled = await PermissionModule.isBlockingEnabled();
          setMonitoringEnabled(!!enabled);
        } catch {}
      }
    })();
    // Subscribe to cross-screen rating changes
    const unsub = onTacticsRatingChanged(({ rating, username }) => {
      setTacticsRating(rating);
      if (username != null) setChessUsername(username);
    });
    return unsub;
  }, []);

  const toggleMonitoring = () => {
    if (Platform.OS !== 'android' || !PermissionModule) return;
    if (monitoringEnabled) {
      Alert.alert(
        'Pause Blocking',
        'This will pause app blocking until you re-enable it or until tomorrow. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Pause',
            style: 'destructive',
            onPress: () => {
              try {
                if (typeof PermissionModule.stopMonitoring === 'function') {
                  PermissionModule.stopMonitoring();
                }
              } catch {}
              setMonitoringEnabled(false);
            },
          },
        ],
      );
    } else {
      try {
        if (typeof PermissionModule.startMonitoring === 'function') {
          PermissionModule.startMonitoring();
        }
      } catch {}
      setMonitoringEnabled(true);
    }
  };
  const importRating = async () => {
    if (!chessUsername) return;
    try {
      setImporting(true);
      const res = await fetch(`https://api.chess.com/pub/player/${chessUsername}/stats`);
      const json = await res.json();
      const rating = json?.tactics?.highest?.rating ?? null;
      if (rating != null) {
        setTacticsRating(rating);
        await saveChessUsername(chessUsername);
        await setChessTacticsRating(rating);
      }
    } catch {}
    finally { setImporting(false); }
  };

  const toggleApp = (key) => {
    const currentBlocked = blocked || {};
    const isCurrentlyBlocked = !!currentBlocked[key];

    // If user tries to un-block (turn off) but has already used
    // the maximum number of untoggles, ignore the action.
    if (isCurrentlyBlocked && blockedUntoggleCount >= MAX_UNTOGGLES) {
      return;
    }

    const next = { ...currentBlocked, [key]: !isCurrentlyBlocked };
    setBlocked(next);
    // persist asynchronously; don't block UI
    try { persistSetBlocked(next); } catch {}

    // Count only untoggles: when moving from blocked -> unblocked
    if (isCurrentlyBlocked && !next[key]) {
      const nextCount = blockedUntoggleCount + 1;
      setBlockedUntoggleCountState(nextCount);
      try { setBlockedUntoggleCount(nextCount); } catch {}
    }
  };

  const themeOptions = [
    { key: 'classic', label: 'Green', primary: '#739552', secondary: '#ebecd0' },
    { key: 'warm', label: 'Brown', primary: '#b88762', secondary: '#edd6b0' },
    { key: 'blue', label: 'Blue', primary: '#4b7399', secondary: '#d6e9f8ff' },
    { key: 'rose', label: 'Pink', primary: '#eca3b0ff', secondary: '#f8d4ddff' },
  ];

  const applyTheme = (opt) => {
    setThemeKey(opt.key);
    themeController.applyTheme(opt);
    setTheme({ key: opt.key, primary: opt.primary, secondary: opt.secondary });
    savePreferences({ problemTarget, theme: { key: opt.key, primary: opt.primary, secondary: opt.secondary } });
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
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.sectionHeader}>
        <Ionicons name="shield-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Blocked Apps</Text>
      </View>
      {SOCIAL_APPS.map((item) => {
        const isOn = !!blocked[item.key];
        return (
          <View key={item.key} style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name={item.icon} size={28} color={BRAND_COLORS[item.key] || colors.text} />
              <Text style={styles.rowLabel}>{item.label}</Text>
            </View>
            <Switch
              value={isOn}
              onValueChange={() => toggleApp(item.key)}
              disabled={isOn && blockedUntoggleCount >= MAX_UNTOGGLES}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
        );
      })}
      {remainingUntoggles > 0 ? (
        <Text style={styles.helperText}>
          <Text style={{ fontWeight: '900', color: colors.text }}>Only {remainingUntoggles} unblocks left. </Text>
          Once used, unblocking will be disabled to keep you on track.
        </Text>
      ) : (
        <Text style={styles.helperText}>
          Your blocked apps list is now frozen because the maximum number of unblocks has been reached. 
          {"\n"}
          Uninstalling NoScroll to bypass these limits would result in yet another failed attempt to reclaim your time from social media.
        </Text>
      )}

      <View style={styles.sectionHeader}>
        <Ionicons name="extension-puzzle-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Daily Puzzle Goal</Text>
      </View>
      <View style={styles.pillRow}>
        {[1, 3, 5, 10, 20].map(n => {
          const active = problemTarget === n;
          return (
            <Pressable key={n} onPress={() => { setProblemTarget(n); savePreferences({ problemTarget: n }); }} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helperText}>Selected social media apps will be blocked until you solve your daily goal of {problemTarget} puzzles.</Text>
      <View style={styles.sectionHeader}>
        <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Tactics Rating</Text>
      </View>
      {tacticsRating != null ? (
        <>
          <Text style={styles.cardLabel}>Tactics Highest Rating</Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{tacticsRating}</Text>
          <Text style={styles.helperText}>Imported for {chessUsername}</Text>
          <Pressable onPress={async () => { await clearChessImport(); setTacticsRating(null); setChessUsername(''); }} style={[styles.primaryBtn, { marginTop: 10, backgroundColor: colors.error }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Clear & Re-import</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.cardLabel}>Chess.com Username</Text>
          <TextInput
            value={chessUsername}
            onChangeText={(t) => { setChessUsername(t); saveChessUsername(t); }}
            placeholder="e.g., jskarthik45"
            style={styles.input}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Pressable onPress={importRating} style={[styles.primaryBtn, { opacity: chessUsername && !importing ? 1 : 0.6 }]} disabled={!chessUsername || importing}>
            <Text style={styles.primaryBtnText}>{importing ? 'Importing...' : 'Import'}</Text>
          </Pressable>
          <Text style={styles.helperText}>This rating is used to personalize your puzzle difficulty in practice mode.</Text>
        </>
      )}

      <View style={styles.sectionHeader}>
        <Ionicons name="color-palette-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Theme</Text>
      </View>
      <View style={styles.themeRow}>
        {themeOptions.map(opt => {
          const active = themeKey === opt.key;
          return (
            <Pressable key={opt.key} onPress={() => applyTheme(opt)} style={[styles.themeOption, active && styles.themeOptionActive]}> 
              <View style={styles.themeSwatches}>
                <View style={[styles.swatch, { backgroundColor: opt.primary }]} />
                <View style={[styles.swatch, { backgroundColor: opt.secondary }]} />
              </View>
              <Text style={styles.themeLabel}>{opt.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: 6 }} />}
            </Pressable>
          );
        })}
      </View>

      {Platform.OS === 'android' && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name={monitoringEnabled ? 'shield-checkmark' : 'shield-outline'} size={20} color={colors.text} />
            <Text style={styles.sectionTitle}>Blocking Status</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name={monitoringEnabled ? 'shield-checkmark' : 'shield-outline'} size={28} color={monitoringEnabled ? colors.primary : colors.muted} />
              <Text style={styles.rowLabel}>{monitoringEnabled ? 'Blocking active' : 'Blocking paused'}</Text>
            </View>
            <Switch
              value={monitoringEnabled}
              onValueChange={toggleMonitoring}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
          <Text style={styles.helperText}>
            {monitoringEnabled
              ? 'The app is actively monitoring and blocking selected apps. You can pause blocking at any time.'
              : 'Blocking is paused. Selected apps are not being blocked. Toggle on to resume blocking.'}
          </Text>
        </>
      )}

      <View style={styles.sectionHeader}>
        <Ionicons name="apps-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>More from us</Text>
      </View>
      <View style={styles.linkList}>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.clutchess.tech')}>
          <Ionicons name="planet" size={22} color={colors.text} />
          <Text style={styles.linkLabel}>Clutch Chess</Text>
          <Ionicons name="open-outline" size={20} color={colors.muted} style={styles.linkIconRight} />
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.velacherychessacademy.com')}>
          <Ionicons name="school" size={22} color={colors.text} />
          <Text style={styles.linkLabel}>Velachery Chess Academy</Text>
          <Ionicons name="open-outline" size={20} color={colors.muted} style={styles.linkIconRight} />
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Ionicons name="document-text-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Legal</Text>
      </View>
      <View style={styles.linkList}>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.clutchess.tech/noscroll-privacy-policy')}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.text} />
          <Text style={styles.linkLabel}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={20} color={colors.muted} style={styles.linkIconRight} />
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.clutchess.tech/noscroll-terms')}>
          <Ionicons name="document-text-outline" size={22} color={colors.text} />
          <Text style={styles.linkLabel}>Terms of Service</Text>
          <Ionicons name="open-outline" size={20} color={colors.muted} style={styles.linkIconRight} />
        </Pressable>
      </View>

      <Text style={[styles.helperText, { marginTop: 12, marginBottom: 16, textAlign: 'center' }]}>
        NoScroll only monitors which app is in the foreground to enable blocking.{"\n"}
        We do not read, collect, or transmit any personal data, messages, or browsing history.
      </Text>

    </ScrollView>
    {/* no time picker modal - removed */}
    </>
  );
}

// Removed outdated static styles block; dynamic styles generated via styleFactory + useThemedStyles.

// picker/time styles removed
