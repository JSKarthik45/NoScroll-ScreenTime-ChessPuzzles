import { map } from 'lodash';
import { supabase } from '../services/supabase';
import { loadPreferences } from '../storage/preferences';

const DEFAULT_BUCKET_SIZE = 1000;
// To avoid infinite loops when advancing id windows
const MAX_BUCKET_HOPS = 20;

export async function getPuzzlesData(tableName, limit = 10, rangeStart = null, rangeSize = DEFAULT_BUCKET_SIZE) {
    const mapRows = (rows) => (rows || []).map((row) => ({
        id: (typeof row.id === 'number' ? row.id : null),
        key: String(row.id ?? row.key ?? Math.random()),
        fen: row.fen,
        turnText: row.turnText || row.turn || 'White to play',
        text: row.text || 'Can you solve this puzzle?',
        correctMove: row.correctMove ?? null,
    }));

    const mapRowsFromPuzzles = (rows) => (rows || []).map((row) => {
        const fen = row.fen || '';
        const parts = typeof fen === 'string' ? fen.split(' ') : [];
        const color = parts.length >= 2 ? parts[1] : 'w';
        const turnText = color === 'b' ? 'Black to play' : 'White to play';
        const text = row.text || 'Can you solve this puzzle?';
        return {
            id: (typeof row.id === 'number' ? row.id : null),
            key: String(row.id ?? row.key ?? Math.random()),
            fen: row.fen,
            turnText,
            text,
            correctMove: row.correctMove ?? null,
        };
    });

    // Unified Puzzles table with optional id windows
    try {
        const hasRange = typeof rangeStart === 'number' && Number.isFinite(rangeStart);
        const bucketStart = hasRange ? rangeStart : 0;
        const bucketSize = (typeof rangeSize === 'number' && Number.isFinite(rangeSize) && rangeSize > 0) ? rangeSize : DEFAULT_BUCKET_SIZE;
        let currentStart = hasRange ? bucketStart : null;

        if (tableName === 'TrendingPuzzles') {
            let hops = 0;
            // If no explicit rangeStart was provided, we do a single full-table style query
            do {
                const lowerId = typeof currentStart === 'number' && Number.isFinite(currentStart) ? currentStart : null;
                const upperId = typeof lowerId === 'number' ? lowerId + bucketSize : null;

                let q = supabase
                    .from('Puzzles')
                    .select('*');

                if (lowerId != null && upperId != null) {
                    q = q.gte('id', lowerId).lt('id', upperId);
                }

                q = q
                    .order('popularity', { ascending: false })
                    .order('id', { ascending: true })
                    .limit(limit);

                const { data, error } = await q;
                if (!error && Array.isArray(data) && data.length > 0) {
                    return mapRowsFromPuzzles(data);
                }

                if (currentStart == null) {
                    break; // caller didn't supply a range window; avoid hopping indefinitely
                }

                currentStart += bucketSize;
                hops += 1;
            } while (hops <= MAX_BUCKET_HOPS);
        } else if (tableName === 'PracticePuzzles') {
            const prefs = await loadPreferences();
            const rating = (typeof prefs?.chessTacticsRating === 'number' && Number.isFinite(prefs.chessTacticsRating))
                ? prefs.chessTacticsRating
                : 1500;
            if (typeof rating === 'number' && Number.isFinite(rating)) {
                // If no explicit rangeStart was provided, just do a single query filtered by rating.
                if (!hasRange) {
                    let q = supabase
                        .from('Puzzles')
                        .select('*')
                        .lte('lowestRating', rating)
                        .gte('highestRating', rating)
                        .order('id', { ascending: true })
                        .limit(limit);

                    const { data, error } = await q;
                    if (!error && Array.isArray(data) && data.length > 0) {
                        return mapRowsFromPuzzles(data);
                    }
                } else {
                    // When a rangeStart is provided, accumulate results across successive id windows
                    // (each of size bucketSize) until we collect `limit` rows or hit hop limit.
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
                            .select('*')
                            .gte('id', lowerId).lt('id', upperId)
                            .lte('lowestRating', rating)
                            .gte('highestRating', rating)
                            .order('id', { ascending: true })
                            .limit(limit - collected.length);

                        const { data, error } = await q;
                        if (!error && Array.isArray(data) && data.length > 0) {
                            collected = collected.concat(data);
                        }

                        currentStart += bucketSize;
                        hops += 1;
                    }

                    if (collected.length > 0) {
                        const finalRows = collected.slice(0, limit);
                        return mapRowsFromPuzzles(finalRows);
                    }
                }
            }
        } else {
            let hops = 0;
            do {
                const lowerId = typeof currentStart === 'number' && Number.isFinite(currentStart) ? currentStart : null;
                const upperId = typeof lowerId === 'number' ? lowerId + bucketSize : null;

                let q = supabase
                    .from('Puzzles')
                    .select('*');

                if (lowerId != null && upperId != null) {
                    q = q.gte('id', lowerId).lt('id', upperId);
                }

                q = q
                    .order('id', { ascending: true })
                    .limit(limit);

                const { data, error } = await q;
                if (!error && Array.isArray(data) && data.length > 0) {
                    return mapRowsFromPuzzles(data);
                }

                if (currentStart == null) {
                    break; // caller didn't supply a range window; avoid hopping indefinitely
                }

                currentStart += bucketSize;
                hops += 1;
            } while (hops <= MAX_BUCKET_HOPS);
        }
    } catch {
        // Ignore and return empty on error
    }

    // On error or no data, return empty array
    return [];
}