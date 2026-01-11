import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Animated, Easing, Vibration } from 'react-native';
//import { Audio } from 'expo-av';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useHeaderHeight } from '@react-navigation/elements';
import ChessBoard from './ChessBoard';
import { Ionicons } from '@expo/vector-icons';
import { incrementTodayPuzzleCount } from '../storage/preferences';
import { useThemeColors, useThemedStyles } from '../theme/ThemeContext';

/**
 * BoardPanel
 * Combines a ChessBoard with overlay action buttons (like/share) and turn text.
 * Props:
 *  - fen: FEN string ("start" or custom)
 *  - turnText: string displayed bottom-left (default: 'White to play')
 *  - borderRadius: number for board rounding
 *  - initialLiked / initialShared: booleans
 *  - onLikeChange / onShareChange: callbacks receiving new state
 */
const styleFactory = (colors) => StyleSheet.create({
  root: { flex: 1 },
  boardCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actionsRight: { position: 'absolute', right: 16, alignItems: 'center', gap: 5},
  actionBtn: {},
  leftTextWrap: { position: 'absolute', left: 16, alignItems: 'flex-start' },
  sideText: { fontSize: 20, fontWeight: '700', color: colors.text },
  iconOnlyBtn: { alignItems: 'center', justifyContent: 'center' },
  filledIcon: {},
  bigHeartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerOverlay: {
    position: 'absolute',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  bannerText: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
});

export default function BoardPanel({
  fen,
  turnText = 'White to play',
  borderRadius = 10,
  initialLiked = false,
  initialShared = false,
  onLikeChange,
  onShareChange,
  heightFraction = 1,
  text = "Can you solve this puzzle?", 
  correctMove = null,
  onAdvance,
  autoAdvance = false,
  boardId,
  onMarkViewed,
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [shared, setShared] = useState(initialShared);
  const lastLikeTap = useRef(0);
  const tabBarHeight = useBottomTabBarHeight();
  const overlayBottom = tabBarHeight / 4; // minimal gap just above bottom navbar
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const headerHeight = useHeaderHeight();
  const availableHeight = windowHeight - headerHeight - tabBarHeight; // space between navbars
  const targetHeight = Math.max(0, (availableHeight - 16) * heightFraction);
  const boardSize = Math.min(windowWidth, targetHeight);
  const boardTop = (availableHeight - boardSize) / 2; // centered board top within root
  const bannerWidth = boardSize - 24;
  const bannerEstimatedHeight = 40; // approx banner height
  const bannerTop = Math.max(boardTop - bannerEstimatedHeight - 6, 0);

  // Big heart animation overlay
  const bigHeartScale = useRef(new Animated.Value(0)).current;
  const bigHeartOpacity = useRef(new Animated.Value(0)).current;
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [bannerText, setBannerText] = useState(text);
  const [bannerVariant, setBannerVariant] = useState('default'); // default|correct|incorrect
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [confettiItems, setConfettiItems] = useState([]); // poured confetti pieces
  const lastPanelTap = useRef(0);
  const correctSoundRef = useRef(null);
  const [soundLoaded, setSoundLoaded] = useState(false);
  const [solved, setSolved] = useState(false); // ensure daily counter increments only once per puzzle

  // Reset per-puzzle local state when the board changes
  React.useEffect(() => {
    setLiked(initialLiked || false);
    setShared(initialShared || false);
    setSolved(false);
    setBannerVariant('default');
    setBannerText(text);
  }, [boardId, text, initialLiked, initialShared, fen]);

  const triggerBigHeart = () => {
    setShowBigHeart(true);
    bigHeartScale.setValue(0.3);
    bigHeartOpacity.setValue(0.9);
    Animated.sequence([
      Animated.timing(bigHeartScale, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bigHeartOpacity, {
        toValue: 0,
        duration: 800,
        delay: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setShowBigHeart(false));
  };

  const handleLikePress = () => {
    const now = Date.now();
    if (now - lastLikeTap.current < 300) {
      setLiked(true);
      onLikeChange && onLikeChange(true);
      triggerBigHeart();
    } else {
      setLiked(prev => {
        const next = !prev;
        onLikeChange && onLikeChange(next);
        if (next) triggerBigHeart();
        return next;
      });
    }
    lastLikeTap.current = now;
  };

  // Double tap anywhere on panel to like
  const handlePanelTouch = () => {
    const now = Date.now();
    const DOUBLE_TAP_MAX_MS = 180; // strict fast double-tap only
    if (now - lastPanelTap.current < DOUBLE_TAP_MAX_MS) {
      if (!liked) {
        setLiked(true);
        onLikeChange && onLikeChange(true);
        triggerBigHeart();
      }
    }
    lastPanelTap.current = now;
  };

  const handleSharePress = () => {
    setShared(prev => {
      const next = !prev;
      onShareChange && onShareChange(next);
      return next;
    });
  };

  /*const playCorrectSound = async () => {
    try {
      if (!soundLoaded) {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/correct.mp3'),
          { shouldPlay: true, volume: 0.9 }
        );
        correctSoundRef.current = sound;
        setSoundLoaded(true);
      } else if (correctSoundRef.current) {
        await correctSoundRef.current.replayAsync();
      }
    } catch (e) {
      // silently ignore missing asset
    }
  };*/

  const evaluateMove = (move) => {
    if (!move || !move.san) return;
    const isCorrect = !correctMove || move.san === correctMove;
    if (isCorrect) {
      if (!solved) {
        setSolved(true);
        // Increment today's solved puzzle counter for streak tracking
        incrementTodayPuzzleCount();
        try { if (onMarkViewed && boardId != null) onMarkViewed(boardId); } catch {}
      }
      setBannerVariant('correct');
      setBannerText('Correct');
      launchConfetti();
      //playCorrectSound();
    } else {
      setBannerVariant('incorrect');
      setBannerText('Incorrect');
      triggerShake();
      try { Vibration.vibrate(120); } catch {}
    }
    // No automatic advance unless explicitly enabled
    if (autoAdvance && onAdvance) {
      setTimeout(() => {
        onAdvance();
        setBannerVariant('default');
        setBannerText(text);
      }, 2500);
    }
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const launchConfetti = () => {
    const palette = [colors.success, '#ffd700', colors.primary, colors.secondary];
    const items = [];
    const total = 70; // dense vertical pour across full width
    for (let i = 0; i < total; i++) {
      const id = Date.now() + '-' + i;
      const x = Math.random() * windowWidth; // span full width
      const size = 6 + Math.random() * 10;
      const fall = new Animated.Value(0);
      const rotate = new Animated.Value(0);
      const sway = new Animated.Value(0);
      const clr = palette[i % palette.length];
      items.push({ id, x, size, fall, rotate, sway, clr });
      Animated.parallel([
        Animated.timing(fall, { toValue: 1, duration: 1900 + Math.random()*900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration: 1600 + Math.random()*800, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 1, duration: 1900 + Math.random()*900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    setConfettiItems(items);
    setTimeout(() => setConfettiItems([]), 200);
  };

  const shakeTranslate = shakeAnim.interpolate({ inputRange: [-1,1], outputRange: [-6,6] });

  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);

  // Keep last non-empty FEN to avoid flicker when prop is briefly undefined
  const lastFenRef = useRef(fen && typeof fen === 'string' && fen.length > 0 ? fen : null);
  if (fen && typeof fen === 'string' && fen.length > 0 && lastFenRef.current !== fen) {
    lastFenRef.current = fen;
  }
  const effectiveFen = lastFenRef.current || 'start';

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateX: shakeTranslate }] }] }
      onTouchEndCapture={handlePanelTouch}
    >
      <View style={styles.boardCenter}>
        <ChessBoard
          fen={effectiveFen}
          size={boardSize}
          borderRadius={borderRadius}
          onMove={evaluateMove}
        />
      </View>
      <View style={[
        styles.bannerOverlay,
        {
          top: bannerTop,
          width: bannerWidth,
          left: (windowWidth - bannerWidth) / 2,
          backgroundColor: bannerVariant === 'correct' ? colors.success : bannerVariant === 'incorrect' ? colors.error : colors.surface,
        },
      ]}>
        <Text style={[styles.bannerText, { color: bannerVariant === 'default' ? colors.text : '#fff' }]}>{bannerText}</Text>
      </View>
      <View style={[styles.actionsRight, { bottom: overlayBottom }]} pointerEvents="box-none">
        <Pressable onPress={handleLikePress} style={styles.iconOnlyBtn} hitSlop={12}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={33}
            color={colors.text}
            style={liked ? styles.filledIcon : null}
          />
        </Pressable>
        <Pressable onPress={handleSharePress} style={[styles.iconOnlyBtn, { marginTop: 16 }]} hitSlop={12}>
          <Ionicons
            name={shared ? 'paper-plane' : 'paper-plane-outline'}
            size={33}
            color={colors.text}
          />
        </Pressable>
      </View>
      <View style={[styles.leftTextWrap, { bottom: overlayBottom }]} pointerEvents="none">
        <Text style={styles.sideText}>{turnText}</Text>
      </View>
      {showBigHeart && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bigHeartOverlay,
            {
              opacity: bigHeartOpacity,
              transform: [{ scale: bigHeartScale }],
            },
          ]}
        >
          <Ionicons name="heart" size={120} color={colors.error} />
        </Animated.View>
      )}
      {confettiItems.length > 0 && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          {confettiItems.map(item => {
            const translateY = item.fall.interpolate({ inputRange: [0,1], outputRange: [-40, windowHeight] });
            const translateX = item.sway.interpolate({ inputRange: [0,1], outputRange: [0, (Math.random()*80 - 40)] });
            const rotateDeg = item.rotate.interpolate({ inputRange: [0,1], outputRange: ['0deg','900deg'] });
            const opacity = item.fall.interpolate({ inputRange: [0,1], outputRange: [1, 0] });
            return (
              <Animated.View
                key={item.id}
                style={{
                  position: 'absolute',
                  left: item.x,
                  top: -50,
                  width: item.size,
                  height: item.size,
                  backgroundColor: item.clr,
                  borderRadius: 3,
                  transform: [
                    { translateY },
                    { translateX },
                    { rotate: rotateDeg },
                  ],
                  opacity,
                }}
              />
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}
