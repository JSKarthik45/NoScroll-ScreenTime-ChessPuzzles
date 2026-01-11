import { getPuzzlesData } from '../services/getData';
import { getLatestPuzzleId } from '../storage/preferences';

// Exported mutable arrays; keep reference stable so consumers see updates after mutation.
export const trendingPuzzles = [];
export const practicePuzzles = [];

// Internal load process (fires immediately on module import)
// Initial asynchronous population (mutates arrays in place)
(async () => {
  const [lastT, lastP] = await Promise.all([
    getLatestPuzzleId('TrendingPuzzles'),
    getLatestPuzzleId('PracticePuzzles'),
  ]);
  const [t, p] = await Promise.all([
    getPuzzlesData('TrendingPuzzles', 10, lastT),
    getPuzzlesData('PracticePuzzles', 10, lastP),
  ]);
    trendingPuzzles.splice(0, trendingPuzzles.length, ...t);
    practicePuzzles.splice(0, practicePuzzles.length, ...p);
})();

// Optional helper if a component wants to refresh manually
export async function refreshPuzzles({ afterTrendingId = null, afterPracticeId = null } = {}) {
  // If caller doesn't specify offsets, continue from latest viewed IDs
  if (afterTrendingId == null || afterPracticeId == null) {
    const [lastT, lastP] = await Promise.all([
      afterTrendingId == null ? getLatestPuzzleId('TrendingPuzzles') : Promise.resolve(afterTrendingId),
      afterPracticeId == null ? getLatestPuzzleId('PracticePuzzles') : Promise.resolve(afterPracticeId),
    ]);
    afterTrendingId = lastT;
    afterPracticeId = lastP;
  }

  const [t, p] = await Promise.all([
    getPuzzlesData('TrendingPuzzles', 10, afterTrendingId),
    getPuzzlesData('PracticePuzzles', 10, afterPracticeId),
  ]);
  trendingPuzzles.splice(0, trendingPuzzles.length, ...t);
  practicePuzzles.splice(0, practicePuzzles.length, ...p);
  return { trendingPuzzles, practicePuzzles };
}
