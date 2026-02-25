import { supabase } from '../services/supabase';
import { loadPreferences } from '../storage/preferences';

const DEFAULT_BUCKET_SIZE = 1000;
// To avoid infinite loops when advancing id windows
const MAX_BUCKET_HOPS = 20;

// Only fetch the columns we actually use
const SELECT_COLUMNS = 'id,fen,text,correctMove,popularity,lowestRating,highestRating';

function mapRowsFromPuzzles(rows) {
    return (rows || []).map((row) => {
        const fen = row.fen || '';
        const parts = typeof fen === 'string' ? fen.split(' ') : [];
        const color = parts.length >= 2 ? parts[1] : 'w';
        const turnText = color === 'b' ? 'Black to play' : 'White to play';
        const text = row.text || 'Can you solve this puzzle?';
        return {
            id: (typeof row.id === 'number' ? row.id : null),
            key: String(row.id ?? Math.random()),
            fen: row.fen,
            turnText,
            text,
            correctMove: row.correctMove ?? null,
        };
    });
}

export async function getPuzzlesData(tableName, limit = 10, rangeStart = null, rangeSize = DEFAULT_BUCKET_SIZE) {
    try {
        const hasRange = typeof rangeStart === 'number' && Number.isFinite(rangeStart);
        const bucketSize = (typeof rangeSize === 'number' && Number.isFinite(rangeSize) && rangeSize > 0) ? rangeSize : DEFAULT_BUCKET_SIZE;
        let currentStart = hasRange ? rangeStart : null;

        if (tableName === 'TrendingPuzzles') {
            let hops = 0;
            do {
                const lowerId = typeof currentStart === 'number' && Number.isFinite(currentStart) ? currentStart : null;
                const upperId = typeof lowerId === 'number' ? lowerId + bucketSize : null;

                let q = supabase
                    .from('Puzzles')
                    .select(SELECT_COLUMNS);

                if (lowerId != null && upperId != null) {
                    q = q.gte('id', lowerId).lt('id', upperId);
                }

                q = q
                    .order('popularity', { ascending: false })
                    .order('id', { ascending: true })
                    .limit(limit);

                const { data, error } = await q;
                if (error) throw error;
                if (Array.isArray(data) && data.length > 0) {
                    return mapRowsFromPuzzles(data);
                }

                if (currentStart == null) {
                    break;
                }

                currentStart += bucketSize;
                hops += 1;
            } while (hops <= MAX_BUCKET_HOPS);
        } else if (tableName === 'PracticePuzzles') {
            const prefs = await loadPreferences();
            const rating = (typeof prefs?.chessTacticsRating === 'number' && Number.isFinite(prefs.chessTacticsRating))
                ? prefs.chessTacticsRating
                : 1500;

            if (!hasRange) {
                let q = supabase
                    .from('Puzzles')
                    .select(SELECT_COLUMNS)
                    .lte('lowestRating', rating)
                    .gte('highestRating', rating)
                    .order('id', { ascending: true })
                    .limit(limit);

                const { data, error } = await q;
                if (error) throw error;
                if (Array.isArray(data) && data.length > 0) {
                    return mapRowsFromPuzzles(data);
                }
            } else {
                let hops = 0;
                let collected = [];

                while (
                    typeof currentStart === 'number' &&
                    Number.isFinite(currentStart) &&
                    collected.length < limit &&
                    hops <= MAX_BUCKET_HOPS
                ) {
                    const lowerId = currentStart;
                    const upperId = currentStart + bucketSize;

                    let q = supabase
                        .from('Puzzles')
                        .select(SELECT_COLUMNS)
                        .gte('id', lowerId).lt('id', upperId)
                        .lte('lowestRating', rating)
                        .gte('highestRating', rating)
                        .order('id', { ascending: true })
                        .limit(limit - collected.length);

                    const { data, error } = await q;
                    if (error) throw error;
                    if (Array.isArray(data) && data.length > 0) {
                        collected = collected.concat(data);
                    }

                    currentStart += bucketSize;
                    hops += 1;
                }

                if (collected.length > 0) {
                    return mapRowsFromPuzzles(collected.slice(0, limit));
                }
            }
        } else {
            let hops = 0;
            do {
                const lowerId = typeof currentStart === 'number' && Number.isFinite(currentStart) ? currentStart : null;
                const upperId = typeof lowerId === 'number' ? lowerId + bucketSize : null;

                let q = supabase
                    .from('Puzzles')
                    .select(SELECT_COLUMNS);

                if (lowerId != null && upperId != null) {
                    q = q.gte('id', lowerId).lt('id', upperId);
                }

                q = q
                    .order('id', { ascending: true })
                    .limit(limit);

                const { data, error } = await q;
                if (error) throw error;
                if (Array.isArray(data) && data.length > 0) {
                    return mapRowsFromPuzzles(data);
                }

                if (currentStart == null) {
                    break;
                }

                currentStart += bucketSize;
                hops += 1;
            } while (hops <= MAX_BUCKET_HOPS);
        }
    } catch (_) {
        // Return empty on error; caller handles fallback
    }

    return [];
}