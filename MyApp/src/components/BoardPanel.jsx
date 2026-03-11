import React, { useState, useRef, useEffect } from 'react';
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
  isActive = true,
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
  const bannerBottom = (availableHeight + boardSize + 100) / 2 + 6;

  // Big heart animation overlay
  const bigHeartScale = useRef(new Animated.Value(0)).current;
  const bigHeartOpacity = useRef(new Animated.Value(0)).current;
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [bannerText, setBannerText] = useState(text);
  const [bannerVariant, setBannerVariant] = useState('default'); // default|correct|incorrect
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lastPanelTap = useRef(0);
  const correctSoundRef = useRef(null);
  const [soundLoaded, setSoundLoaded] = useState(false);
  const [solved, setSolved] = useState(false); // ensure daily counter increments only once per puzzle
  const [boardDisabled, setBoardDisabled] = useState(false);
  const [moveAttempted, setMoveAttempted] = useState(false);
  const chessRef = useRef(null);
  const correctMovesRef = useRef([]);
  const moveIndexRef = useRef(0);
  const heartBtnScale = useRef(new Animated.Value(1)).current;

  // Reset per-puzzle local state when the board changes
  React.useEffect(() => {
    setLiked(initialLiked || false);
    setShared(initialShared || false);
    setSolved(false);
    setBoardDisabled(false);
    setMoveAttempted(false);
    setBannerVariant('default');
    setBannerText(text);
  }, [boardId, text, initialLiked, initialShared, fen]);

  const triggerBigHeart = () => {
    setShowBigHeart(true);
    bigHeartScale.setValue(0.2);
    bigHeartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(bigHeartScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(bigHeartOpacity, {
        toValue: 0,
        duration: 600,
        delay: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setShowBigHeart(false));
  };

  const bounceHeartBtn = () => {
    heartBtnScale.setValue(0.5);
    Animated.spring(heartBtnScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }).start();
  };

  const handleLikePress = () => {
    const now = Date.now();
    bounceHeartBtn();
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

  // Multi-move puzzle system: parse correctMove string, auto-play computer's first move
  useEffect(() => {
    if (!correctMove || !chessRef.current) return;
    if (!isActive) {
      setBoardDisabled(true);
      return;
    }
    const moves = correctMove.trim().split(/\s+/);
    correctMovesRef.current = moves;
    moveIndexRef.current = 0;
    if (moves.length === 0) return;
    // Auto-play computer's first move after a short delay
    setBoardDisabled(true);
    const timer = setTimeout(() => {
      if (chessRef.current) {
        chessRef.current.makeMove(moves[0]);
        moveIndexRef.current = 1;
      }
      if (moves.length <= 1) {
        // Single-move puzzle: already solved by computer
        setSolved(true);
      } else {
        setBoardDisabled(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [correctMove, boardId, isActive]);

  const evaluateMove = (move) => {
    if (!move || !move.san) return;
    const moves = correctMovesRef.current;
    setMoveAttempted(true);
    if (!moves || moves.length === 0) {
      // No solution defined — accept any move
      if (!solved) {
        setSolved(true);
        incrementTodayPuzzleCount();
        try { if (onMarkViewed && boardId != null) onMarkViewed(boardId); } catch {}
      }
      setBannerVariant('correct');
      setBannerText('Correct');
      return;
    }
    const expectedIdx = moveIndexRef.current;
    const expectedSan = moves[expectedIdx];
    if (move.san !== expectedSan) {
      // Incorrect move
      setBannerVariant('incorrect');
      setBannerText('Incorrect');
      setBoardDisabled(true);
      triggerShake();
      try { Vibration.vibrate(120); } catch {}
      return;
    }
    // Correct move
    moveIndexRef.current = expectedIdx + 1;
    if (moveIndexRef.current >= moves.length) {
      // All moves completed
      if (!solved) {
        setSolved(true);
        incrementTodayPuzzleCount();
        try { if (onMarkViewed && boardId != null) onMarkViewed(boardId); } catch {}
      }
      setBannerVariant('correct');
      setBannerText('Correct');
      setBoardDisabled(true);
    } else {
      // More moves remain — auto-play computer's next move
      setBoardDisabled(true);
      setTimeout(() => {
        if (chessRef.current && moveIndexRef.current < moves.length) {
          chessRef.current.makeMove(moves[moveIndexRef.current]);
          moveIndexRef.current += 1;
          if (moveIndexRef.current >= moves.length) {
            if (!solved) {
              setSolved(true);
              incrementTodayPuzzleCount();
              try { if (onMarkViewed && boardId != null) onMarkViewed(boardId); } catch {}
            }
            setBannerVariant('correct');
            setBannerText('Correct');
          } else {
            setBoardDisabled(false);
          }
        }
      }, 400);
    }
    // No automatic advance unless explicitly enabled
    if (autoAdvance && onAdvance && moveIndexRef.current >= moves.length) {
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

  const shakeTranslate = shakeAnim.interpolate({ inputRange: [-1,1], outputRange: [-6,6] });

  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);

  // Keep last non-empty FEN to avoid flicker when prop is briefly undefined
  const lastFenRef = useRef(fen && typeof fen === 'string' && fen.length > 0 ? fen : null);
  if (fen && typeof fen === 'string' && fen.length > 0 && lastFenRef.current !== fen) {
    lastFenRef.current = fen;
  }
  const effectiveFen = lastFenRef.current || 'start';

  // Board flip: when it's black's turn, render from black's perspective
  const flipped = typeof turnText === 'string' && turnText.toLowerCase().includes('black');

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateX: shakeTranslate }] }] }
      onTouchEndCapture={handlePanelTouch}
    >
      <View style={styles.boardCenter}>
        <ChessBoard
          ref={chessRef}
          fen={effectiveFen}
          size={boardSize}
          borderRadius={borderRadius}
          onMove={evaluateMove}
          disabled={boardDisabled}
          flipped={flipped}
        />
      </View>
      <View style={[
        styles.bannerOverlay,
        {
          bottom: bannerBottom,
          width: bannerWidth,
          left: (windowWidth - bannerWidth) / 2,
          backgroundColor: bannerVariant === 'correct' ? colors.success : bannerVariant === 'incorrect' ? colors.error : colors.surface,
        },
      ]}>
        <Text style={[styles.bannerText, { color: bannerVariant === 'default' ? colors.text : '#fff' }]}>{bannerText}</Text>
      </View>
      <View style={[styles.actionsRight, { bottom: overlayBottom }]} pointerEvents="box-none">
        <Pressable onPress={handleLikePress} style={styles.iconOnlyBtn} hitSlop={12}>
          <Animated.View style={{ transform: [{ scale: heartBtnScale }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={33}
              color={liked ? colors.error : colors.text}
            />
          </Animated.View>
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
    </Animated.View>
  );
}
