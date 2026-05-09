# Puzzle Fetching Architecture Report

This report outlines the end-to-end data fetching process for chess puzzles within the application. It covers how the React Native frontend interfaces with Supabase, the specific pagination strategies used to maintain performance and variety, and the prefetching mechanisms designed for a seamless user experience.

## 1. Initialization and State Management
The fetching lifecycle is managed primarily within `HomeScreen.jsx`. The app maintains state for two separate puzzle modes: **Trending** and **Practice**.

When the app loads:
1. **Storage Lookup**: It reads `LATEST_KEYS` from local `AsyncStorage` (via `preferences.js`) to find the `bucketStart` ID for both modes. This ID acts as the global cursor.
2. **Initial Fetch**: It calls `getPuzzlesData(tableName, PAGE_SIZE, bucketStart, BUCKET_SIZE)` with a page size of 10 and a bucket size of 1000.
3. **Deriving the Bucket**: If no local cursor exists (e.g., a fresh install), `bucketStart` is `null`. The fetcher derives the first valid bucket from the database, and `HomeScreen.jsx` persists this starting point for future sessions.

## 2. The "Bucket" Pagination Strategy
Instead of traditional `LIMIT`/`OFFSET` pagination (which is slow for deep pages) or strictly cursor-based pagination (which makes ordering by secondary columns like `popularity` difficult to iterate), the app uses an **ID Window (Bucket)** approach.

The database query targets an explicit window: 
`WHERE id >= currentStart AND id < currentStart + 1000`

### Why Buckets?
- **For Trending Puzzles**: Within the bucket window, the query sorts by `popularity DESC`. This ensures the user sees the most popular puzzles *from that specific block of 1000 IDs*. When the user finishes the batch, the app moves to the next bucket. This prevents the user from repeatedly seeing the exact same globally popular puzzles forever and ensures continuous variety.
- **For Practice Puzzles**: The query applies a user-specific rating filter (`lowestRating <= userRating <= highestRating`). The bucket logic is still used here to keep the API contract consistent and to allow `HomeScreen.jsx` to manage advancement predictably.

## 3. Data Fetching Optimizations (`getData.js`)
The `getPuzzlesData` function handles the heavy lifting of communicating with Supabase. It features two critical optimizations to ensure the API fetch is near-instantaneous:

1. **Instant Min-ID Lookup (Cold Start Optimization)**
   If `currentStart` is `null`, it does not perform a global sort (which would require scanning the entire database). Instead, it queries `SELECT id FROM Puzzles ORDER BY id ASC LIMIT 1`. This instantly finds where the data actually begins and sets the first bucket start point.
   
2. **Intelligent Bucket Jumping (Sparse Data Optimization)**
   If an ID window (bucket) is empty or only partially filled (e.g., due to sparse IDs or strict rating filters), the code does not blindly hop forward by 1,000 IDs and check again. Instead, it executes a fast indexed query to find the *next valid ID* (`SELECT id FROM Puzzles WHERE id >= upperId LIMIT 1`). It then instantly advances `currentStart` to that exact ID's bucket. This turns potentially dozens of empty round-trip network requests into a single, fast lookup.

## 4. Seamless User Experience (Prefetching)
To ensure the user never sees a loading spinner while swiping through puzzles, `HomeScreen.jsx` implements a background prefetching mechanism.

1. **Trigger Point**: The app tracks the user's progress through the current batch of 10 puzzles using `batchIndex`.
2. **Background Fetch**: When the user reaches index `7` (the 8th puzzle out of 10), the `handleIndexChange` function asynchronously triggers a fetch for the *next* bucket.
3. **Array Concatenation**: The new puzzles are silently appended to the React state array (`setTrendData((prev) => [...prev, ...nextBatch])`).
4. **Cleanup and Advancement**: Once the user swipes past the 10th puzzle, the app slices off the first 10 items from the array, officially updates the persistent `bucketStart` cursor in `AsyncStorage`, and resets the local `batchIndex` counter to begin the cycle anew.

## Summary
The combination of **bucket-based sampling** (for variety), **intelligent ID jumping** (for speed), and **background prefetching** (for UX) creates a robust, high-performance fetching pipeline capable of efficiently handling databases with millions of rows.
