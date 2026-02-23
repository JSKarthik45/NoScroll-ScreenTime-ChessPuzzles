import React, { useRef, useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ScrollView, Animated, TouchableOpacity, Platform, Alert, AppState, NativeModules, PermissionsAndroid, Linking } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CircleButton from '../../components/CircleButton';
import { OnboardingContext } from '../../navigation/OnboardingContext';
import { useThemeColors, useThemedStyles } from '../../theme/ThemeContext';
import SettingsQuickSetup from '../../components/SettingsQuickSetup';
import { startUsagePolling } from '../../services/usageLogger';
import { loadPreferences, savePreferences, setBlocked as persistSetBlocked } from '../../storage/preferences';

const { width } = Dimensions.get('window');

// Collection A: The Hook
const HOOK_PAGES = [
  { key: 'problem' },
  { key: 'solution' },
  { key: 'motivation' },
];

// Collection B: The Action (setup first, then core permissions, then OEM help, then pricing placeholder)
const ACTION_PAGES = [
  { key: 'setup' },
  { key: 'dataDisclosure' },
  { key: 'permissions' },
  { key: 'oemPermissions' },
  { key: 'pricing' },
];

const styleFactory = (colors) => StyleSheet.create({
  container: { flex: 1 },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 90,
  },
  pageAction: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  subtitleAction: { 
    marginTop: 12,
    marginBottom: 18,
    textAlign: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { marginTop: 10, textAlign: 'center' },
  dots: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
  fullButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: { fontSize: 16, color: colors.text, textAlign: 'center', marginTop: 12},
  permissionContent: { fontSize: 16, color: colors.text, textAlign: 'left'},
});

const ensureNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch (e) {
      // ignore; service will still attempt to start
    }
  }
};

export default function OnboardingPager() {
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const prevIndexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('hook'); // 'hook' | 'action'
  const [usageGranted, setUsageGranted] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);
  const { completeOnboarding } = useContext(OnboardingContext);
  const [blocked, setBlocked] = useState({});
  const [problemTarget, setProblemTarget] = useState(5);

  const { PermissionModule } = NativeModules;

  const activePages = phase === 'hook' ? HOOK_PAGES : ACTION_PAGES;

  useEffect(() => {
    (async () => {
      const pref = await loadPreferences();
      setBlocked(pref.blocked || {});
      setProblemTarget(pref.problemTarget ?? 5);
    })();
  }, []);

  const goNext = async () => {
    const isLastHookPage = phase === 'hook' && index === HOOK_PAGES.length - 1;

    // Phase transition: from Collection A → Collection B
    if (isLastHookPage) {
      // animate fade and also allow FAB -> full-button visual (quick cross-fade)
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setPhase('action');
        setIndex(0);
        requestAnimationFrame(() => {
          try { listRef.current?.scrollToIndex({ index: 0, animated: false }); } catch (e) { try { listRef.current?.scrollToOffset({ offset: 0, animated: false }); } catch {} }
          Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
        });
      });
      return;
    }

    const currentPages = phase === 'hook' ? HOOK_PAGES : ACTION_PAGES;
    const currentKey = currentPages[index]?.key;
    const next = index + 1;

    // Persist setup when leaving the setup page in Collection B
    if (phase === 'action' && currentKey === 'setup') {
      try { await persistSetBlocked(blocked); } catch {}
      await savePreferences({ problemTarget });
    }

    if (next < currentPages.length) {
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      // End of Collection B: finish onboarding
      await completeOnboarding();
    }
  };

  // When phase changes, ensure FlatList starts at index 0 immediately
  useEffect(() => {
    if (!listRef.current) return;
    // run on next frame after re-render to ensure data changed
    requestAnimationFrame(() => {
      try {
        listRef.current.scrollToIndex({ index: 0, animated: false });
      } catch (e) {
        // fallback to offset
        try { listRef.current.scrollToOffset({ offset: 0, animated: false }); } catch {}
      }
    });
  }, [phase]);

  // Floating animations reused across pages
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const floatUpDownA = floatA.interpolate({ inputRange: [0, 1], outputRange: [6, -6] });
  const floatUpDownB = floatB.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const fade = useRef(new Animated.Value(1)).current;

  const isLastHookPage = phase === 'hook' && index === HOOK_PAGES.length - 1;
  const isLastActionPage = phase === 'action' && index === ACTION_PAGES.length - 1;
  const fabIcon = isLastHookPage || isLastActionPage ? 'checkmark' : 'arrow-forward';

  const showFullWidthButton = phase === 'action' && (index === 1 || index === 2 || index === 3 || index === 4);

  const canContinueFromPermissions = usageGranted && overlayGranted;

  const handlePermissionsCta = () => {
    if (!canContinueFromPermissions) return;
    const next = 3;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const startTrial = async () => {
    try {
      // Sync the latest blocked configuration to native so it can be used
      // by any background monitoring or future services.
      const blockedJson = JSON.stringify(blocked || {});
      if (PermissionModule && typeof PermissionModule.syncBlockedList === 'function') {
        PermissionModule.syncBlockedList(blockedJson);
      }

      // Ensure we have POST_NOTIFICATIONS permission on Android 13+
      // so the foreground service notification can be shown reliably.
      await ensureNotificationPermission();

      // Start native foreground monitoring service so blocking works
      // even when the app is in the background.
      if (PermissionModule && typeof PermissionModule.startMonitoring === 'function') {
        PermissionModule.startMonitoring();
      }

      // Start foreground polling for usage events while the app is open.
      startUsagePolling(blocked, (pkg) => {
        // Later: navigate to a dedicated puzzle screen here.
      });
    } catch (e) {
      // silently ignore
    }

    await completeOnboarding();
  };

  // When entering the permissions page (or when app resumes), verify overlay & usage permissions
  useEffect(() => {
    const update = async () => {
      if (phase === 'action' && index === 2 && PermissionModule) {
        try {
          const [overlay, usage] = await Promise.all([
            PermissionModule.checkOverlayPermission(),
            PermissionModule.checkUsageStatsPermission(),
          ]);
          setOverlayGranted(!!overlay);
          setUsageGranted(!!usage);
        } catch (e) {
          // leave as-is on error
        }
      }
    };

    update();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });

    return () => {
      sub.remove();
    };
  }, [phase, index, PermissionModule]);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['top', 'left', 'right']}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={activePages}
        keyExtractor={(item) => item.key}
        scrollEnabled={!(phase === 'action' && (index === 1 || index === 2))}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
          prevIndexRef.current = newIndex;
        }}
        renderItem={({ item }) => {
          if (item.key === 'problem') {
            return (
              <View style={[styles.page, { width, backgroundColor: colors.background }]}>
                <Text style={[styles.title, { color: colors.primary }]}>Distracted by endless scrolling?</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Social apps grab your attention and drain hours every day, breaking your focus and delaying your goals.
                </Text>
                <View style={{ position: 'absolute', top: 80, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
                  <Animated.View style={{ position: 'absolute', left: 16, top: 40, transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="facebook" size={36} color="#1877F2" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', right: 24, top: 120, transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="twitter" size={36} color="#1DA1F2" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', left: width / 2 - 18, top: 20, transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="instagram" size={36} color="#E1306C" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', left: width / 4, top: 200, transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="youtube" size={36} color="#FF0000" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', left: 102, bottom: 200, transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="snapchat" size={36} color="#FFFC00" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', right: 36, bottom: 220, transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="tiktok" size={36} color="#ffffffff" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', left: width - 100, top: 260, transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="reddit" size={36} color="#FF4500" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', left: 60, top: 300, transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="whatsapp" size={36} color="#25D366" />
                  </Animated.View>
                </View>
              </View>
            );
          }

          if (item.key === 'solution') {
            return (
              <View style={[styles.page, { width, backgroundColor: colors.background }]}>
                <Text style={[styles.title, { color: colors.primary }]}>Turn distractions into progress</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Block selected apps until you complete a set of chess puzzles. Build focus, sharpen thinking, and earn back your time.
                </Text>
                <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="chess-king" size={36} color={colors.primary} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="chess-queen" size={36} color={colors.secondary} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="chess-bishop" size={34} color={colors.text} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="chess-knight" size={34} color={colors.muted} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownA }] }}>
                    <FontAwesome5 name="chess-rook" size={34} color={colors.primary} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownB }] }}>
                    <FontAwesome5 name="chess-pawn" size={34} color={colors.secondary} />
                  </Animated.View>
                </View>
              </View>
            );
          }

          if (item.key === 'motivation') {
            return (
              <View style={[styles.page, { width, backgroundColor: colors.background }]}>
                <Text style={[styles.title, { color: colors.primary }]}>Rewire your brain and habits</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Crush puzzles. Unblock apps. Repeat. Watch your discipline grow, your habits change, and your time return to you.
                </Text>
                <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownA }] }}>
                    <Ionicons name="fitness" size={36} color={colors.primary} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownB }] }}>
                    <Ionicons name="trending-up" size={36} color={colors.secondary} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownA }] }}>
                    <Ionicons name="time" size={36} color={colors.text} />
                  </Animated.View>
                  <Animated.View style={{ transform: [{ translateY: floatUpDownB }] }}>
                    <Ionicons name="calendar" size={34} color={colors.muted} />
                  </Animated.View>
                </View>
              </View>
            );
          }

          if (item.key === 'dataDisclosure') {
            return (
              <ScrollView
                style={{ width }}
                contentContainerStyle={[styles.pageAction, { backgroundColor: colors.background, paddingBottom: 100 }]}
              >
                <Ionicons name="shield-checkmark" size={56} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
                <Text style={[styles.title, { color: colors.primary }]}>Your Data, Your Device</Text>
                <Text style={[styles.subtitle, styles.subtitleAction, { color: colors.muted }]}>
                  Transparency matters. Here's exactly what this app does and doesn't do.
                </Text>

                <View style={{ marginTop: 8, gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Ionicons name="eye-outline" size={22} color={colors.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.permissionContent, { flex: 1 }]}>
                      This app monitors which app is currently in the foreground on your device{' '}
                      <Text style={{ fontWeight: '700' }}>solely to enable app blocking</Text>.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Ionicons name="close-circle-outline" size={22} color={colors.error} style={{ marginTop: 2 }} />
                    <Text style={[styles.permissionContent, { flex: 1 }]}>
                      We do <Text style={{ fontWeight: '700' }}>not</Text> read, collect, store, or transmit any personal data, messages, browsing history, or app content.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.permissionContent, { flex: 1 }]}>
                      All your preferences and puzzle progress are stored <Text style={{ fontWeight: '700' }}>locally on your device</Text>.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Ionicons name="settings-outline" size={22} color={colors.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.permissionContent, { flex: 1 }]}>
                      You can revoke permissions or pause blocking at any time from Settings or the notification.
                    </Text>
                  </View>
                </View>

                <Text style={[styles.content, { marginTop: 20, textAlign: 'center', color: colors.muted, fontSize: 13 }]}>
                  By tapping "I Agree & Continue" below, you consent to this app detecting foreground app usage for blocking purposes only.
                </Text>
              </ScrollView>
            );
          }

          if (item.key === 'permissions') {
            return (
              <View style={[styles.pageAction, { width, backgroundColor: colors.background, paddingTop: 0 }]}>
                <Text style={[styles.title, { color: colors.primary }]}>We need a little help</Text>
                <Text style={[styles.subtitle, styles.subtitleAction, { color: colors.muted }]}>
                  To block distractions, we require special access permissions.
                </Text>
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.permissionContent]}>USAGE ACCESS</Text>
                  <Text style={[styles.permissionContent]}>
                    Lets the app know which app is currently open so it can show you a chess puzzle instead of your chosen distractions.
                  </Text>
                  <TouchableOpacity
                    onPress={() => PermissionModule?.openUsageSettings()}
                    style={{ marginTop: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-center', backgroundColor: colors.primary }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>Grant usage access permission</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 15 }}>
                  <Text style={[styles.permissionContent]}>OVERLAY</Text>
                  <Text style={[styles.permissionContent]}>
                    Allows the app to appear on top when a blocked app is opened, so you see your puzzle instead of the feed.
                  </Text>
                  <TouchableOpacity
                    onPress={() => PermissionModule?.openOverlaySettings()}
                    style={{ marginTop: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-center', backgroundColor: colors.primary }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>Grant overlay permission</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          if (item.key === 'oemPermissions') {
            return (
              <View style={[styles.pageAction, { width, backgroundColor: colors.background }]}> 
                <Text style={[styles.title, { color: colors.primary }]}>Make it work on your phone</Text>
                <Text style={[styles.subtitle, styles.subtitleAction, { color: colors.muted }]}>
                  Some devices (like Xiaomi/Redmi or OnePlus) need one extra step so blocking keeps working in the background.
                </Text>
                <Text style={[styles.content, { textAlign: 'left' }]}>
                  1. If you have a Xiaomi/Redmi phone: open App info → Other permissions and turn on "Display pop-up windows while running in the background" for this app.{"\n"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    try {
                      Linking.openSettings();
                    } catch (e) {
                      // silently ignore
                    }
                  }}
                  style={{ marginTop: 0, paddingVertical: 12, borderRadius: 10, alignSelf: 'stretch', backgroundColor: colors.primary }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>For Xiaomi/Redmi: Open app info</Text>
                </TouchableOpacity>
                <Text style={[styles.content, { marginTop: 15, textAlign: 'left' }]}>
                  2. If you have a OnePlus phone: go to Settings → Apps & notifications → Special access → Display pop-ups while in background, find this app, and allow it so we can show puzzles while running in the background.
                </Text>
              </View>
            );
          }

          if (item.key === 'setup') {
            return (
              <ScrollView
                style={{ width }}
                contentContainerStyle={[styles.pageAction, { backgroundColor: colors.background }]}
              >
                <Text style={[styles.title, { color: colors.primary }]}>Quick setup</Text>
                <Text style={[styles.subtitle, styles.subtitleAction, { color: colors.muted }]}>Choose which apps to block and how many puzzles to solve before they unlock.</Text>
                <SettingsQuickSetup
                  blocked={blocked}
                  setBlocked={setBlocked}
                  problemTarget={problemTarget}
                  setProblemTarget={setProblemTarget}
                />
              </ScrollView>
            );
          }

          if (item.key === 'pricing') {
            return (
              <View style={[styles.pageAction, { width, backgroundColor: colors.background }]}> 
                <Text style={[styles.title, { color: colors.primary }]}>Free now, simple later</Text>
                <Text style={[styles.subtitle, styles.subtitleAction, { color: colors.muted }]}>
                  Unlock full access to your potential and reclaim your hours from endless scrolling.
                </Text>
                <Text style={[styles.content]}>
                  During early access, everything is free so you can focus on building the habit.
                </Text>
                <Text style={[styles.content]}>
                  In the future, we may offer a simple, optional subscription to support development—no ads, no dark patterns, just clear
                  pricing.
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.clutchess.tech/noscroll-privacy-policy')}
                  style={{ marginTop: 16, alignSelf: 'center' }}
                >
                  <Text style={{ color: colors.primary, textDecorationLine: 'underline', fontSize: 14 }}>
                    Read our Privacy Policy
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          return null;
        }}
      />
      </Animated.View>

      <View style={[styles.dots, { bottom: insets.bottom + 96 }]}>
        {activePages.map((p, i) => (
          <View
            key={p.key}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      {/* Full-width action buttons for Action pages (permissions / pricing) */}
      {phase === 'action' && index === 1 && (
        <TouchableOpacity
          onPress={() => {
            const next = 2;
            setIndex(next);
            listRef.current?.scrollToIndex({ index: next, animated: true });
          }}
          style={[styles.fullButton, { bottom: insets.bottom + 24, backgroundColor: colors.primary }]}
        >
          <Text style={[styles.fullButtonText, { color: 'white' }]}>I Agree & Continue</Text>
        </TouchableOpacity>
      )}
      {phase === 'action' && index === 2 && (
        <TouchableOpacity
          onPress={handlePermissionsCta}
          disabled={!canContinueFromPermissions}
          style={[
            styles.fullButton,
            {
              bottom: insets.bottom + 24,
              backgroundColor: canContinueFromPermissions ? colors.primary : colors.border,
              opacity: canContinueFromPermissions ? 1 : 0.6,
            },
          ]}
        >
          <Text style={[styles.fullButtonText, { color: canContinueFromPermissions ? 'white' : 'black' }]}>
            {canContinueFromPermissions ? 'Continue' : 'Grant permissions to proceed'}
          </Text>
        </TouchableOpacity>
      )}
      {phase === 'action' && index === 3 && (
        <TouchableOpacity
          onPress={() => {
            const next = 4;
            setIndex(next);
            listRef.current?.scrollToIndex({ index: next, animated: true });
          }}
          style={[styles.fullButton, { bottom: insets.bottom + 24, backgroundColor: colors.primary }]}
        >
          <Text style={[styles.fullButtonText, { color: 'white' }]}>Continue</Text>
        </TouchableOpacity>
      )}
      {phase === 'action' && index === 4 && (
        <TouchableOpacity onPress={startTrial} style={[styles.fullButton, { bottom: insets.bottom + 24, backgroundColor: colors.primary }]}> 
          <Text style={[styles.fullButtonText, { color: 'white' }]}>Start free trial</Text>
        </TouchableOpacity>
      )}

      {/* No animated FAB expansion (removed) */}

      {/* Floating circle button hidden on the two Action pages with full-width buttons */}
      {!showFullWidthButton && (
        <CircleButton
          onPress={goNext}
          icon={fabIcon}
          backgroundColor={colors.primary}
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
        />
      )}
    </SafeAreaView>
  );
}
