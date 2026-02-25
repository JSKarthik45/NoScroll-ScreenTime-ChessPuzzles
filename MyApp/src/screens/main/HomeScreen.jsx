import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors, useThemedStyles } from '../../theme/ThemeContext';
import BoardPager from '../../components/BoardPager';
import { getPuzzlesData } from '../../services/getData';
import { getLatestPuzzleId, setLatestPuzzleId, getBatchIndex, setBatchIndex } from '../../storage/preferences';

const styleFactory = (colors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 0, paddingVertical: 0, backgroundColor: colors.background },
});

export default function HomeScreen({ mode = 'Trending' }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);
  const [trendData, setTrendData] = React.useState([]);
  const [practiceData, setPracticeData] = React.useState([]);

  const [trendBucketStart, setTrendBucketStart] = React.useState(null);
  const [practiceBucketStart, setPracticeBucketStart] = React.useState(null);
  const [trendPrefetchedNext, setTrendPrefetchedNext] = React.useState(false);
  const [practicePrefetchedNext, setPracticePrefetchedNext] = React.useState(false);
  const [trendInitialIndex, setTrendInitialIndex] = React.useState(0);
  const [practiceInitialIndex, setPracticeInitialIndex] = React.useState(0);

  const BUCKET_SIZE = 1000;
  const PAGE_SIZE = 10;
  const PREFETCH_INDEX_IN_BATCH = 7; // 0-based index 7 => 8th puzzle

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [storedT, storedP, storedIdxT, storedIdxP] = await Promise.all([
          getLatestPuzzleId('TrendingPuzzles'),
          getLatestPuzzleId('PracticePuzzles'),
          getBatchIndex('TrendingPuzzles'),
          getBatchIndex('PracticePuzzles'),
        ]);

        // Use stored bucket if available, otherwise fetch without a range window
        // so we don't waste hops guessing an arbitrary starting ID.
        const bucketT = (typeof storedT === 'number' && Number.isFinite(storedT)) ? storedT : null;
        const bucketP = (typeof storedP === 'number' && Number.isFinite(storedP)) ? storedP : null;

        let [t, p] = await Promise.all([
          getPuzzlesData('TrendingPuzzles', PAGE_SIZE, bucketT, BUCKET_SIZE),
          getPuzzlesData('PracticePuzzles', PAGE_SIZE, bucketP, BUCKET_SIZE),
        ]);

        // Fallbacks: if no puzzles in the current id window, try again without a window
        if (!Array.isArray(t) || t.length === 0) {
          t = await getPuzzlesData('TrendingPuzzles', PAGE_SIZE, null);
        }
        if (!Array.isArray(p) || p.length === 0) {
          p = await getPuzzlesData('PracticePuzzles', PAGE_SIZE, null);
        }

        if (!mounted) return;

        // Derive the actual bucket start from the first returned puzzle's id,
        // rounded down to the nearest BUCKET_SIZE boundary.
        const tArr = Array.isArray(t) ? t : [];
        const pArr = Array.isArray(p) ? p : [];
        const deriveBucket = (items) => {
          const firstId = items.length > 0 && typeof items[0].id === 'number' ? items[0].id : 0;
          return Math.floor(firstId / BUCKET_SIZE) * BUCKET_SIZE;
        };
        const effectiveBucketT = bucketT ?? deriveBucket(tArr);
        const effectiveBucketP = bucketP ?? deriveBucket(pArr);

        // Persist derived bucket so future sessions start from here
        if (storedT == null && tArr.length > 0) {
          try { setLatestPuzzleId('TrendingPuzzles', effectiveBucketT); } catch {}
        }
        if (storedP == null && pArr.length > 0) {
          try { setLatestPuzzleId('PracticePuzzles', effectiveBucketP); } catch {}
        }

        setTrendBucketStart(effectiveBucketT);
        setPracticeBucketStart(effectiveBucketP);
        setTrendData(tArr);
        setPracticeData(pArr);
        // Set the initial index within the batch (clamped to data length)
        setTrendInitialIndex(Math.min(storedIdxT || 0, Math.max(0, tArr.length - 1)));
        setPracticeInitialIndex(Math.min(storedIdxP || 0, Math.max(0, pArr.length - 1)));
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const handleIndexChange = React.useCallback(async (tableName, index) => {
    try {
      // Always persist the current index within the batch
      setBatchIndex(tableName, index);

      if (tableName === 'TrendingPuzzles') {
        if (trendBucketStart == null) return;
        const currentLength = trendData.length;
        if (currentLength === 0) return;
        const batchIndex = index % PAGE_SIZE;

        // When user moves to the 8th puzzle in the current batch, prefetch next 10
        if (!trendPrefetchedNext && currentLength <= PAGE_SIZE && batchIndex === PREFETCH_INDEX_IN_BATCH) {
          const nextBucketStart = trendBucketStart + BUCKET_SIZE;
          const nextBatch = await getPuzzlesData('TrendingPuzzles', PAGE_SIZE, nextBucketStart);
          if (Array.isArray(nextBatch) && nextBatch.length > 0) {
            setTrendData((prev) => [...prev, ...nextBatch]);
            setTrendPrefetchedNext(true);
          }
          return;
        }

        // After initial 10 are completed (index >= 10) and we have prefetched, drop first 10 and advance bucket
        if (trendPrefetchedNext && currentLength > PAGE_SIZE && index >= PAGE_SIZE) {
          const newBucketStart = trendBucketStart + BUCKET_SIZE;
          setTrendData((prev) => prev.slice(PAGE_SIZE));
          setTrendBucketStart(newBucketStart);
          setTrendPrefetchedNext(false);
          // Persist so next session starts from the new bucket range
          setLatestPuzzleId('TrendingPuzzles', newBucketStart);
          // Reset batch index to 0 since we're starting a new batch
          setBatchIndex('TrendingPuzzles', 0);
        }
      } else if (tableName === 'PracticePuzzles') {
        if (practiceBucketStart == null) return;
        const currentLength = practiceData.length;
        if (currentLength === 0) return;
        const batchIndex = index % PAGE_SIZE;

        if (!practicePrefetchedNext && currentLength <= PAGE_SIZE && batchIndex === PREFETCH_INDEX_IN_BATCH) {
          const nextBucketStart = practiceBucketStart + BUCKET_SIZE;
          const nextBatch = await getPuzzlesData('PracticePuzzles', PAGE_SIZE, nextBucketStart);
          if (Array.isArray(nextBatch) && nextBatch.length > 0) {
            setPracticeData((prev) => [...prev, ...nextBatch]);
            setPracticePrefetchedNext(true);
          }
          return;
        }

        if (practicePrefetchedNext && currentLength > PAGE_SIZE && index >= PAGE_SIZE) {
          const newBucketStart = practiceBucketStart + BUCKET_SIZE;
          setPracticeData((prev) => prev.slice(PAGE_SIZE));
          setPracticeBucketStart(newBucketStart);
          setPracticePrefetchedNext(false);
          setLatestPuzzleId('PracticePuzzles', newBucketStart);
          // Reset batch index to 0 since we're starting a new batch
          setBatchIndex('PracticePuzzles', 0);
        }
      }
    } catch {}
  }, [
    trendBucketStart,
    practiceBucketStart,
    trendData.length,
    practiceData.length,
    trendPrefetchedNext,
    practicePrefetchedNext,
    PAGE_SIZE,
    PREFETCH_INDEX_IN_BATCH,
    BUCKET_SIZE,
  ]);

  return (
    <View style={styles.container}>
      {mode === 'Trending' ? (
        <BoardPager
          boards={trendData}
          transitionMode="preload"
          tableName="TrendingPuzzles"
          onIndexChange={(index) => handleIndexChange('TrendingPuzzles', index)}
          initialIndex={trendInitialIndex}
        />
      ) : (
        // Add other mode components here
        <BoardPager
          boards={practiceData}
          transitionMode="preload"
          tableName="PracticePuzzles"
          onIndexChange={(index) => handleIndexChange('PracticePuzzles', index)}
          initialIndex={practiceInitialIndex}
        />
      )}
    </View>
  );
}

// styles generated via hook
