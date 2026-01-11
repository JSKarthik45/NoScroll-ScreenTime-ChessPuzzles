import React, { useMemo, useRef, useCallback, useState, memo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, FlatList, Dimensions } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useHeaderHeight } from '@react-navigation/elements';
import BoardPanel from './BoardPanel';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

// We will preload the NEXT board instead of a blank transition

export default function BoardPager({ boards, transitionMode = 'blank', tableName = null, onIndexChange = null }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight() / 4;
  const headerHeight = useHeaderHeight() / 4;
  const { height: windowHeight } = Dimensions.get('window');
  const fallbackHeight = Math.max(1, windowHeight - insets.top - insets.bottom - tabBarHeight - headerHeight);
  const [pageHeight, setPageHeight] = useState(fallbackHeight);
  const listRef = useRef(null);

  // Respond to length changes even if the array reference is stable
  const source = useMemo(() => (Array.isArray(boards) ? boards : []), [boards, boards?.length]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [commitPending, setCommitPending] = useState(false);
  const commitBoardRef = useRef(null);
  const [pendingAdvance, setPendingAdvance] = useState(false);

  // Build two-page buffer with stable slot keys so panels don't remount
  const pages = useMemo(() => {
    if (source.length === 0) {
      // Fallback single page while data loads
      return [
        { slotKey: 'slot-0', board: { key: 'loading', fen: 'start', turnText: '', text: 'Loading…', correctMove: null } },
      ];
    }
    const len = source.length;
    const curr = source[currentIdx % len];
    const next = source[(currentIdx + 1) % len];
    
    if (commitPending && commitBoardRef.current) {
      const b = commitBoardRef.current;
      return [
        { slotKey: 'slot-0', board: b },
        { slotKey: 'slot-1', board: b },
      ];
    }
    if (transitionMode === 'preload') {
      return [
        { slotKey: 'slot-0', board: curr },
        { slotKey: 'slot-1', board: next },
      ];
    }
    // default: blank transition page (no default start position)
    return [
      { slotKey: 'slot-0', board: curr },
      { slotKey: 'slot-1', board: { key: `blank-${next?.key ?? currentIdx+1}`, fen: EMPTY_FEN, turnText: '', text: '', correctMove: null } },
    ];
  }, [source, currentIdx, commitPending, transitionMode]);

  const PageItem = memo(function PageItem({ item, height, onAdvance }) {
    const board = item.board || {};
    return (
      <View style={{ height, overflow: 'hidden' }}>
        <BoardPanel
          key={board.key}
          fen={board.fen}
          turnText={board.turnText}
          borderRadius={10}
          heightFraction={1}
          text={board.text}
          correctMove={board.correctMove}
          onAdvance={onAdvance}
          autoAdvance={false}
          boardId={board.key}
          onMarkViewed={null}
        />
      </View>
    );
  });

  const advance = useCallback(() => {
    if (source.length < 1) return;
    setPendingAdvance(true);
    listRef.current?.scrollToOffset({ offset: pageHeight, animated: true });
  }, [pageHeight, source.length]);

  const renderItem = useCallback(({ item }) => (
    <PageItem item={item} height={pageHeight} onAdvance={advance} />
  ), [pageHeight, advance]);
  const getItemLayout = useCallback((_, index) => ({ length: pageHeight, offset: pageHeight * index, index }), [pageHeight]);

  const recycleForward = useCallback(() => {
    if (source.length === 0) return;
    const nextIdx = (currentIdx + 1) % source.length;
    // Prepare commit so both pages show the same board (the one user just saw)
    const len = source.length;
    const nextBoard = source[(currentIdx + 1) % len];
    
    commitBoardRef.current = nextBoard;
    setCommitPending(true);
    // Now jump back to page 0 without animation; content remains the same during the jump
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // Then finalize index on next frame and clear commit state
    const defer = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
    defer(() => {
      setCurrentIdx(nextIdx);
      if (typeof onIndexChange === 'function') {
        try { onIndexChange(nextIdx); } catch {}
      }
      setCommitPending(false);
      commitBoardRef.current = null;
    });
  }, [currentIdx, source, onIndexChange]);

  const onScrollEnd = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const page = Math.round(y / pageHeight);
    // Always recycle when reaching page 1 to mimic the illusion
    if (page === 1 && source.length > 0) {
      recycleForward();
    }
  }, [pageHeight, recycleForward, source.length]);

  // If incoming boards shrink or grow, keep currentIdx in range
  useEffect(() => {
    if (source.length === 0) return;
    setCurrentIdx((i) => i % source.length);
  }, [source.length]);

  return (
    <View style={{ flex: 1 }} onLayout={(e) => {
      const h = e.nativeEvent.layout.height;
      if (h && h > 0 && h !== pageHeight) setPageHeight(h);
    }}>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item) => item.slotKey}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        style={{ flex: 1 }}
        pagingEnabled
        decelerationRate="fast"
        disableIntervalMomentum={true}
        removeClippedSubviews={transitionMode !== 'preload'}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={16}
        windowSize={3}
        showsVerticalScrollIndicator={false}
        bounces={true}
        onMomentumScrollEnd={onScrollEnd}
      />
    </View>
  );
}
