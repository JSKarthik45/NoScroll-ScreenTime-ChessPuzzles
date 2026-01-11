import React, { useRef, useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ScrollView, Animated } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CircleButton from '../../components/CircleButton';
import { OnboardingContext } from '../../navigation/OnboardingContext';
import { useThemeColors, useThemedStyles } from '../../theme/ThemeContext';
import SettingsQuickSetup from '../../components/SettingsQuickSetup';
import { loadPreferences, savePreferences } from '../../storage/preferences';

const { width } = Dimensions.get('window');

const PAGES = [
  { key: 'problem' },
  { key: 'solution' },
  { key: 'setup' },
  { key: 'motivation' },
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
});

export default function OnboardingPager() {
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const { completeOnboarding } = useContext(OnboardingContext);
  const [blocked, setBlocked] = useState({});
  const [problemTarget, setProblemTarget] = useState(5);

  useEffect(() => {
    (async () => {
      const pref = await loadPreferences();
      setBlocked(pref.blocked || {});
      setProblemTarget(pref.problemTarget ?? 5);
    })();
  }, []);

  const goNext = async () => {
    const next = index + 1;
    if (PAGES[index]?.key === 'setup') {
      await savePreferences({ problemTarget });
    }
    if (next < PAGES.length) {
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      await completeOnboarding();
    }
  };

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
  const floatUpDownA = floatA.interpolate({ inputRange: [0,1], outputRange: [6, -6] });
  const floatUpDownB = floatB.interpolate({ inputRange: [0,1], outputRange: [-5, 5] });

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['top','left','right']}> 
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={PAGES}
        keyExtractor={(item) => item.key}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
        }}
        renderItem={({ item }) => {
          if (item.key === 'problem') {
            return (
              <View style={[styles.page, { width, backgroundColor: colors.background }]}> 
                  <Text style={[styles.title, { color: colors.primary }]}>Distracted by endless scrolling?</Text>
                  <Text style={[styles.subtitle, { color: colors.muted }]}>Scrolling eats your time when you meant to focus or rest.</Text>
                  <View style={{ position: 'absolute', top: 80, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
                    {/* Scatter social icons around screen (hardcoded positions) */}
                    <Animated.View style={{ position: 'absolute', left: 16, top: 40, transform: [{ translateY: floatUpDownA }] }}>
                      <FontAwesome5 name="facebook" size={36} color="#1877F2" />
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', right: 24, top: 120, transform: [{ translateY: floatUpDownB }] }}>
                      <FontAwesome5 name="twitter" size={36} color="#1DA1F2" />
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', left: width/2 - 18, top: 20, transform: [{ translateY: floatUpDownB }] }}>
                      <FontAwesome5 name="instagram" size={36} color="#E1306C" />
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', left: width/4, top: 200, transform: [{ translateY: floatUpDownA }] }}>
                      <FontAwesome5 name="youtube" size={36} color="#FF0000" />
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', left:102, bottom: 200, transform: [{ translateY: floatUpDownB }] }}>
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
                  <Text style={[styles.title, { color: colors.primary }]}>Turn no‑scroll hours into progress</Text>
                  <Text style={[styles.subtitle, { color: colors.muted }]}>Pick the times you want less scrolling. We’ll nudge you then to open this app and solve chess puzzles instead.</Text>
                  {/* Single row of chess pieces below text */}
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
          if (item.key === 'setup') {
            return (
              <ScrollView style={{ width }} contentContainerStyle={[styles.page, { alignItems: 'stretch', backgroundColor: colors.background }]}> 
                  <Text style={[styles.title, { color: colors.primary }]}>Quick setup</Text>
                  {/* <Text style={[styles.subtitle, { color: colors.muted }]}>Choose which apps to block and how many puzzles to solve.</Text> */}
                <SettingsQuickSetup
                  blocked={blocked}
                  setBlocked={setBlocked}
                  problemTarget={problemTarget}
                  setProblemTarget={setProblemTarget}
                />
              </ScrollView>
            );
          }
          // motivation
          return (
            <View style={[styles.page, { width, backgroundColor: colors.background }]}> 
                <Text style={[styles.title, { color: colors.primary }]}>Rewire your brain, one choice at a time</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>Small choices away from scrolling, toward puzzles, add up to stronger focus and better habits.</Text>
                {/* Single row of progress/habits/brain icons */}
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
        }}
      />

      <View style={[styles.dots, { bottom: insets.bottom + 96 }]}>
        {PAGES.map((p, i) => (
          <View key={p.key} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }]} />
        ))}
      </View>

      <CircleButton
        onPress={goNext}
        icon={index === PAGES.length - 1 ? 'checkmark' : 'arrow-forward'}
        backgroundColor={colors.primary}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      />
    </SafeAreaView>
  );
}
