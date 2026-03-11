import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Animated, Dimensions, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PUZZLE_COUNTS_KEY, getPuzzleCounts, incrementTodayPuzzleCount, onPuzzleCountChanged, loadPreferences } from '../../storage/preferences';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemedStyles } from '../../theme/ThemeContext';
import { useIsFocused } from '@react-navigation/native';

// Use shared storage key/helpers for daily puzzle counts
const COUNTS_KEY = PUZZLE_COUNTS_KEY; // { [YYYY-MM-DD]: number }

// Use local timezone for date string (YYYY-MM-DD) so day changes at local midnight
const isoDay = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const hexToRgb = (hex) => {
	let clean = (hex || '').replace('#', '');
	// Support 8-digit hex with alpha suffix (e.g. RRGGBBAA or RRGGBBAA). Strip alpha.
	if (clean.length === 8) clean = clean.substring(0, 6);
	if (clean.length === 4) clean = clean.split('').map(c => c + c).join('');
	if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
	const bigint = parseInt(clean, 16) || 0;
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return { r, g, b };
};

const styleFactory = (colors) => {
	const { width } = Dimensions.get('window');
	const maxCols = 12; // 12 weeks
	const gutter = 4;
	const dayLabelWidth = 24;
	const cellSize = Math.floor((width - 32 - dayLabelWidth - 4 - gutter * (maxCols - 1)) / maxCols);
	return StyleSheet.create({
		root: { flex: 1 },
		centerWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 0, marginBottom: 10 },
		flameWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative', width: 160, height: 160 },
		streakNumber: { fontSize: 42, fontWeight: '900', color: colors.text },
		streakLabel: { fontSize: 15, fontWeight: '600', color: colors.muted },
		streakMotivation: { fontSize: 14, color: colors.muted, marginTop: 4 },
		sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
		sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 8 },
		sectionSubtitle: { fontSize: 13, color: colors.muted, marginBottom: 8, marginLeft: 28 },
		heatmapWrap: { marginTop: 8 },
		heatmapRow: { flexDirection: 'row' },
		dayLabelsCol: { width: dayLabelWidth, marginRight: 4, justifyContent: 'flex-start' },
		row: { flexDirection: 'row' },
		col: { marginRight: gutter },
		cell: { width: cellSize, height: cellSize, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
		cellText: { fontSize: 10, fontWeight: '600' },
		legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
		legendLabel: { fontSize: 11, fontWeight: '500', color: colors.muted, marginRight: 8 },
		legendBox: { width: 14, height: 14, borderRadius: 4, marginRight: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
		rewardCard: {
			marginTop: 20,
			borderRadius: 16,
			paddingVertical: 14,
			paddingHorizontal: 14,
			backgroundColor: colors.primary,
			flexDirection: 'row',
			alignItems: 'center',
			shadowColor: colors.primary,
			shadowOpacity: 0.25,
			shadowRadius: 10,
			shadowOffset: { width: 0, height: 4 },
			elevation: 4,
		},
		rewardIconWrap: {
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: 'rgba(0,0,0,0.18)',
			alignItems: 'center',
			justifyContent: 'center',
			marginRight: 12,
		},
		rewardTextWrap: { flex: 1 },
		rewardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
		rewardSubtitle: { marginTop: 4, fontSize: 13, color: colors.text },
		actionsRow: { position: 'absolute', right: 16, bottom: 16 },
		fab: { backgroundColor: colors.primary, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 2 },
	});
};

export default function StreakScreen() {
	const colors = useThemeColors();
	const styles = useThemedStyles(styleFactory);
	const isFocused = useIsFocused();
	const [counts, setCounts] = useState({}); // { date: number }
	const [dailyGoal, setDailyGoal] = useState(5);
	const [animFlame] = useState(() => new Animated.Value(0)); // burst on change
	const [flicker] = useState(() => new Animated.Value(0)); // quick jitter
	const [bob] = useState(() => new Animated.Value(0)); // slow up/down
	const [glow] = useState(() => new Animated.Value(0)); // pulsing aura

	// Load counts on mount via helper
	useEffect(() => {
		(async () => {
			const loaded = await getPuzzleCounts();
			setCounts(loaded);
			const pref = await loadPreferences();
			setDailyGoal(pref.problemTarget ?? 5);
		})();
		// Subscribe to live increments from gameplay
		const unsubscribe = onPuzzleCountChanged(({ date, count }) => {
			setCounts(prev => ({ ...prev, [date]: count }));
		});
		return () => unsubscribe();
	}, []);

	// Refresh daily goal whenever the Streak tab gains focus
	useEffect(() => {
		if (!isFocused) return;
		(async () => {
			try {
				const pref = await loadPreferences();
				setDailyGoal(pref.problemTarget ?? 5);
			} catch {}
		})();
	}, [isFocused]);

	// Compute weeks (12) x 7 days heatmap data with Sun-Sat aligned columns
	const weeks = useMemo(() => {
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
		const thisWeekSun = addDays(today, -dayOfWeek);
		const start = addDays(thisWeekSun, -11 * 7);
		const out = [];
		for (let c = 0; c < 12; c++) {
			const col = [];
			for (let r = 0; r < 7; r++) {
				const d = addDays(start, c * 7 + r);
				if (d > today) {
					col.push(null); // future date
				} else {
					col.push(isoDay(d));
				}
			}
			out.push(col);
		}
		return out;
	}, [counts]);

	const streakDays = useMemo(() => {
		let s = 0;
		let day = new Date();
		while (true) {
			const key = isoDay(day);
			const c = counts[key] || 0;
			if (c > 0) {
				s += 1;
				day = addDays(day, -1);
			} else {
				break;
			}
		}
		return s;
	}, [counts]);

	// Flame animation bumps on streak change
	useEffect(() => {
		animFlame.setValue(0);
		Animated.spring(animFlame, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }).start();
	}, [streakDays]);

	// Continuous fire animations
	useEffect(() => {
		// subtle scale/rotation jitter
		Animated.loop(
			Animated.sequence([
				Animated.timing(flicker, { toValue: 1, duration: 700, useNativeDriver: true }),
				Animated.timing(flicker, { toValue: 0, duration: 600, useNativeDriver: true }),
				Animated.timing(flicker, { toValue: 1, duration: 500, useNativeDriver: true }),
				Animated.timing(flicker, { toValue: 0, duration: 650, useNativeDriver: true }),
			])
		).start();

		// gentle vertical bobbing
		Animated.loop(
			Animated.sequence([
				Animated.timing(bob, { toValue: 1, duration: 1500, useNativeDriver: true }),
				Animated.timing(bob, { toValue: 0, duration: 1500, useNativeDriver: true }),
			])
		).start();

		// aura pulse
		Animated.loop(
			Animated.sequence([
				Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
				Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
			])
		).start();
	}, []);

	const levelColor = useCallback((n) => {
		// 0, 1-2, 3-4, 5-6, 7+
		const { r, g, b } = hexToRgb(colors.primary || '#2f80ed');
		if (!n) return colors.surface;
		if (n <= 2) return `rgba(${r}, ${g}, ${b}, 0.25)`;
		if (n <= 4) return `rgba(${r}, ${g}, ${b}, 0.45)`;
		if (n <= 6) return `rgba(${r}, ${g}, ${b}, 0.7)`;
		return `rgba(${r}, ${g}, ${b}, 1)`;
	}, [colors.primary, colors.surface]);

	const renderColumn = ({ item }) => (
		<View style={styles.col}>
			{item.map((date, idx) => {
				if (date === null) {
					return <View key={`empty-${idx}`} style={[styles.cell, { backgroundColor: 'transparent', borderWidth: 0, marginBottom: 4 }]} />;
				}
				const n = counts[date] || 0;
				const bg = levelColor(n);
				const isToday = date === isoDay();
				return (
					<View key={date} style={[styles.cell, { backgroundColor: bg, marginBottom: 4 }] }>
						{n > 0 && <Text style={[styles.cellText, { color: n >= 5 ? '#fff' : colors.text }]}>{n}</Text>}
						{isToday && (
							<Ionicons name="ellipse" size={6} color={n ? '#fff' : colors.muted} style={{ position: 'absolute', top: 4, right: 4 }} />
						)}
					</View>
				);
			})}
		</View>
	);

	const incrementToday = useCallback(async () => {
		const count = await incrementTodayPuzzleCount();
		const today = isoDay();
		setCounts(prev => ({ ...prev, [today]: count }));
	}, []);

	const puzzlesLeftToday = useMemo(() => {
		const today = isoDay();
		const done = counts[today] || 0;
		const left = Math.max(0, (dailyGoal || 0) - done);
		return left;
	}, [counts, dailyGoal]);

	return (
		<ScrollView style={styles.root} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
			<View style={styles.centerWrap}>
				{(() => {
					const { r, g, b } = hexToRgb(colors.primary || '#ff6a00');
					const innerSize = 120;
					const outerSize = 160;
					const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.35] });
					const outerGlowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] });
					const innerScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
					const outerScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
					const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [2, -2] });
					const rot = flicker.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1deg'] });
					const flickerScale = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] });
					const burstScale = animFlame.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
					return (
						<Animated.View style={[
							styles.flameWrap,
							{
								transform: [
									{ translateY: bobY },
									{ rotate: rot },
									{ scale: flickerScale },
									{ scale: burstScale },
								],
								shadowColor: `rgba(${r}, ${g}, ${b}, 1)`,
								shadowOpacity: 0.6,
								shadowRadius: 12,
								shadowOffset: { width: 0, height: 0 },
								elevation: 6,
							},
						]}>
							<Animated.View
								style={{
									position: 'absolute',
									width: innerSize,
									height: innerSize,
									borderRadius: innerSize / 2,
									backgroundColor: `rgba(${r}, ${g}, ${b}, 0.45)`,
									opacity: glowOpacity,
									transform: [{ scale: innerScale }],
								}}
							/>
							<Animated.View
								style={{
									position: 'absolute',
									width: outerSize,
									height: outerSize,
									borderRadius: outerSize / 2,
									backgroundColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
									opacity: outerGlowOpacity,
									transform: [{ scale: outerScale }],
								}}
							/>
							<Ionicons name="flame" size={96} color={colors.primary} />
						</Animated.View>
					);
				})()}
				<Text style={styles.streakNumber}>{streakDays}</Text>
				<Text style={styles.streakLabel}>day streak</Text>
				<Text style={styles.streakMotivation}>
					{streakDays >= 7 ? '🔥 On fire! Keep it going!'
						: streakDays >= 3 ? '💪 Great momentum!'
						: streakDays >= 1 ? '✨ Nice start!'
						: 'Solve a puzzle to start your streak!'}
				</Text>
			</View>

			<View style={styles.heatmapWrap}>
				<View style={styles.sectionHeader}>
					<Ionicons name="calendar-outline" size={20} color={colors.text} />
					<Text style={styles.sectionTitle}>Activity</Text>
				</View>
				<Text style={styles.sectionSubtitle}>Last 12 weeks</Text>

				<View style={styles.heatmapRow}>
					<View style={styles.dayLabelsCol}>
						{['', 'M', '', 'W', '', 'F', ''].map((label, i) => (
							<View key={i} style={{ height: styles.cell.width, marginBottom: 4, justifyContent: 'center' }}>
								<Text style={{ fontSize: 11, fontWeight: '500', color: colors.muted }}>{label}</Text>
							</View>
						))}
					</View>
					<FlatList
						horizontal
						showsHorizontalScrollIndicator={false}
						data={weeks}
						keyExtractor={(_, i) => `col-${i}`}
						renderItem={renderColumn}
					/>
				</View>

				<View style={styles.legendRow}>
					<Text style={styles.legendLabel}>Less</Text>
					<View style={[styles.legendBox, { backgroundColor: colors.surface }]} />
					<View style={[styles.legendBox, { backgroundColor: levelColor(1) }]} />
					<View style={[styles.legendBox, { backgroundColor: levelColor(3) }]} />
					<View style={[styles.legendBox, { backgroundColor: levelColor(5) }]} />
					<View style={[styles.legendBox, { backgroundColor: levelColor(8) }]} />
					<Text style={[styles.legendLabel, { marginLeft: 4 }]}>More</Text>
				</View>
			</View>

			<View style={styles.rewardCard}>
				<View style={styles.rewardIconWrap}>
					<Ionicons name="trophy" size={26} color={colors.text} />
				</View>
				<View style={styles.rewardTextWrap}>
					<Text style={styles.rewardTitle}>
						{puzzlesLeftToday === 0 ? 'Goal crushed 🎯' : puzzlesLeftToday === 1 ? 'Checkmate in one' : 'Building momentum'}
					</Text>
					<Text style={styles.rewardSubtitle}>
						{puzzlesLeftToday === 0
							? 'Social apps are unlocked. You earned this.'
							: `Solve ${puzzlesLeftToday} more to unlock your apps.`}
					</Text>
				</View>
			</View>
			
			{/*
			<View style={styles.actionsRow}>
				<Pressable onPress={incrementToday} style={styles.fab} accessibilityLabel="Add one puzzle to today">
					<Ionicons name="add" size={28} color="#fff" />
				</Pressable>
			</View>
			*/}
		</ScrollView>
	);
}

