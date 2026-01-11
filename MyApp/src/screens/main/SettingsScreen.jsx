import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, useThemeColors } from '../../theme/ThemeContext';
import { loadPreferences, savePreferences, setTheme, setChessUsername as saveChessUsername, setChessTacticsRating, clearChessImport } from '../../storage/preferences';
import { scheduleDailyNoScrollNotification } from '../../services/notifications';
import { useThemeController } from '../../theme/ThemeContext';

// No app toggles; replaced by time window selection UI

const styleFactory = (colors) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  scrollContent: { paddingBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: colors.text },
  listContent: { paddingVertical: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { marginLeft: 12, fontSize: 16, color: colors.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.text },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  helperText: { marginTop: 6, color: colors.muted },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  cardLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: colors.text },
  primaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  input: {
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: colors.text,
    fontWeight: '700',
  },
  timePill: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.primary,
  },
  timePillLabel: { color: colors.text, marginBottom: 4 },
  timePillValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  linkLabel: { marginLeft: 12, fontSize: 16, color: colors.text, flex: 1 },
  linkIconRight: { marginLeft: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    width: '48%',
    marginRight: 0,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  themeOptionActive: { borderColor: colors.primary },
  themeSwatches: { flexDirection: 'row', marginRight: 8 },
  swatch: { width: 18, height: 18, borderRadius: 4, marginRight: 4 },
  themeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
});

export default function SettingsScreen() {
  const [blocked, setBlocked] = useState({});
  const [problemTarget, setProblemTarget] = useState(5);
  const [fromTime, setFromTime] = useState(''); // 'HH:mm' 24h
  const [toTime, setToTime] = useState('');
  const [chessUsername, setChessUsername] = useState('');
  const [themeKey, setThemeKey] = useState('classic');
  const [tacticsRating, setTacticsRating] = useState(null);
  const [importing, setImporting] = useState(false);
  const themeController = useThemeController();
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      const pref = await loadPreferences();
      setBlocked(pref.blocked || {}); // legacy
      setProblemTarget(pref.problemTarget ?? 5);
      if (pref.fromTime) setFromTime(pref.fromTime);
      if (pref.toTime) setToTime(pref.toTime);
      if (pref.theme) {
        setThemeKey(pref.theme.key || 'classic');
      }
      if (pref.chessUsername) setChessUsername(pref.chessUsername);
      if (pref.chessTacticsRating != null) setTacticsRating(pref.chessTacticsRating);
    })();
  }, []);
  const importRating = async () => {
    if (!chessUsername) return;
    try {
      setImporting(true);
      const res = await fetch(`https://api.chess.com/pub/player/${chessUsername}/stats`);
      const json = await res.json();
      const rating = json?.tactics?.highest?.rating ?? null;
      if (rating != null) {
        setTacticsRating(rating);
        await saveChessUsername(chessUsername);
        await setChessTacticsRating(rating);
      }
    } catch {}
    finally { setImporting(false); }
  };

  const toggleApp = (key) => {
    // removed app toggles; retained for backward compatibility
  };

  const renderItem = ({ item }) => {
    const isOn = !!blocked[item.key];
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Ionicons name={item.icon} size={24} color={colors.text} />
          <Text style={styles.rowLabel}>{item.label}</Text>
        </View>
        <Switch
          value={isOn}
          onValueChange={() => toggleApp(item.key)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={isOn ? colors.text : '#f4f3f4'}
        />
      </View>
    );
  };

  const themeOptions = [
    { key: 'classic', label: 'Green', primary: '#739552', secondary: '#ebecd0' },
    { key: 'warm', label: 'Brown', primary: '#b88762', secondary: '#edd6b0' },
    { key: 'blue', label: 'Blue', primary: '#4b7399', secondary: '#d6e9f8ff' },
    { key: 'rose', label: 'Pink', primary: '#eca3b0ff', secondary: '#f8d4ddff' },
  ];

  const applyTheme = (opt) => {
    setThemeKey(opt.key);
    themeController.applyTheme(opt);
    setTheme({ key: opt.key, primary: opt.primary, secondary: opt.secondary });
    savePreferences({ problemTarget, theme: { key: opt.key, primary: opt.primary, secondary: opt.secondary } });
  };

  // --- Time window UI helpers ---
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('from'); // 'from' | 'to'
  const [tmpHour, setTmpHour] = useState(9);
  const [tmpMinute, setTmpMinute] = useState(0);
  const [tmpAmPm, setTmpAmPm] = useState('AM');

  const formatTime = (hhmm) => {
    if (!hhmm) return 'Set time';
    const [h, m] = hhmm.split(':').map(n => Number(n));
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const mm = String(m).padStart(2, '0');
    return `${h12}:${mm} ${ampm}`;
  };

  const openPicker = (target) => {
    setPickerTarget(target);
    const src = target === 'from' ? fromTime : toTime;
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes() - (now.getMinutes() % 15);
    if (src) {
      const [sh, sm] = src.split(':').map(Number);
      if (Number.isFinite(sh)) h = sh;
      if (Number.isFinite(sm)) m = sm;
    }
    setTmpHour(((h % 12) || 12));
    setTmpMinute(m);
    setTmpAmPm(h >= 12 ? 'PM' : 'AM');
    setPickerVisible(true);
  };

  const commitPicker = async () => {
    const h24 = (tmpHour % 12) + (tmpAmPm === 'PM' ? 12 : 0);
    const mm = String(tmpMinute).padStart(2, '0');
    const value = `${String(h24).padStart(2, '0')}:${mm}`;
    if (pickerTarget === 'from') setFromTime(value);
    else setToTime(value);
    await savePreferences({
      problemTarget,
      fromTime: pickerTarget === 'from' ? value : fromTime,
      toTime: pickerTarget === 'to' ? value : toTime,
    });
    try {
      await scheduleDailyNoScrollNotification();
    } catch {}
    setPickerVisible(false);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>When do you end up scrolling the most?</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>No-scroll window</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable onPress={() => openPicker('from')} style={[styles.timePill]}>
            <Text style={styles.timePillLabel}>From</Text>
            <Text style={styles.timePillValue}>{formatTime(fromTime)}</Text>
          </Pressable>
          <Pressable onPress={() => openPicker('to')} style={[styles.timePill]}>
            <Text style={styles.timePillLabel}>To</Text>
            <Text style={styles.timePillValue}>{formatTime(toTime)}</Text>
          </Pressable>
        </View>
        <Text style={[styles.helperText, { marginTop: 8 }]}>We’ll nudge you to finish puzzles during this window.</Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Daily puzzle goal</Text>
      <View style={styles.pillRow}>
        {[1, 3, 5, 10, 20].map(n => {
          const active = problemTarget === n;
          return (
            <Pressable key={n} onPress={() => { setProblemTarget(n); savePreferences({ problemTarget: n }); }} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helperText}>If you haven’t hit your {problemTarget}-puzzle goal by no‑scroll time, we’ll nudge you to finish instead of scrolling.</Text>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Tactics Rating from Chess.com</Text>
      <View style={styles.card}>
        {tacticsRating != null ? (
          <>
            <Text style={styles.cardLabel}>Tactics Highest Rating</Text>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{tacticsRating}</Text>
            <Text style={styles.helperText}>Imported for {chessUsername}</Text>
            <Pressable onPress={async () => { await clearChessImport(); setTacticsRating(null); setChessUsername(''); }} style={[styles.primaryBtn, { marginTop: 10, backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Clear & Re-import</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardLabel}>Chess.com Username</Text>
            <TextInput
              value={chessUsername}
              onChangeText={(t) => { setChessUsername(t); saveChessUsername(t); }}
              placeholder="e.g., jskarthik45"
              style={styles.input}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Pressable onPress={importRating} style={[styles.primaryBtn, { opacity: chessUsername && !importing ? 1 : 0.6 }]} disabled={!chessUsername || importing}>
              <Text style={styles.primaryBtnText}>{importing ? 'Importing...' : 'Import'}</Text>
            </Pressable>
            <Text style={styles.helperText}>This rating is used to personalize your puzzle difficulty in practice mode.</Text>
          </>
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Theme</Text>
      <View style={styles.themeRow}>
        {themeOptions.map(opt => {
          const active = themeKey === opt.key;
          return (
            <Pressable key={opt.key} onPress={() => applyTheme(opt)} style={[styles.themeOption, active && styles.themeOptionActive]}> 
              <View style={styles.themeSwatches}>
                <View style={[styles.swatch, { backgroundColor: opt.primary }]} />
                <View style={[styles.swatch, { backgroundColor: opt.secondary }]} />
              </View>
              <Text style={styles.themeLabel}>{opt.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: 6 }} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Our other products and services</Text>
      <View style={styles.linkList}>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.clutchess.tech')}>
          <Ionicons name="planet" size={22} color={colors.text} />
          <Text style={styles.linkLabel}>Clutch Chess</Text>
          <Ionicons name="open-outline" size={20} color={colors.muted} style={styles.linkIconRight} />
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.velacherychessacademy.com')}>
          <Ionicons name="school" size={22} color={colors.text} />
          <Text style={styles.linkLabel}>Velachery Chess Academy</Text>
          <Ionicons name="open-outline" size={20} color={colors.muted} style={styles.linkIconRight} />
        </Pressable>
      </View>

    </ScrollView>
    {/* Time picker modal */}
    <Modal
      visible={pickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setPickerVisible(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '86%', borderRadius: 16, backgroundColor: colors.surface, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Select time</Text>
          {/* Top: two big rectangles for Hour and Minute */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
            <Pressable onPress={() => { /* optional: cycle hour */ }} style={{ flex:1, marginRight:8, height:64, borderRadius:12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color: colors.text, fontSize:28, fontWeight:'800' }}>{tmpHour}</Text>
            </Pressable>
            <View style={{ width:24, alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color: colors.text, fontSize:24, fontWeight:'800' }}>:</Text>
            </View>
            <Pressable onPress={() => { /* optional: cycle minute */ }} style={{ flex:1, marginLeft:8, height:64, borderRadius:12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color: colors.text, fontSize:28, fontWeight:'800' }}>{String(tmpMinute).padStart(2,'0')}</Text>
            </Pressable>
          </View>
          {/* Bottom: smaller AM/PM rectangles */}
          <View style={{ flexDirection:'row', justifyContent:'center', marginBottom:10 }}>
            {['AM','PM'].map(v => (
              <Pressable key={v} onPress={() => setTmpAmPm(v)} style={{ paddingVertical:8, paddingHorizontal:18, marginHorizontal:6, borderRadius:10, backgroundColor: tmpAmPm===v? colors.primary: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                <Text style={{ color: tmpAmPm===v? '#fff': colors.text, fontWeight:'700' }}>{v}</Text>
              </Pressable>
            ))}
          </View>
          {/* Selection chips below for hour and minute */}
          <Text style={{ color: colors.muted, marginBottom:6 }}>Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
              <Pressable key={h} onPress={() => setTmpHour(h)} style={{ paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, borderRadius: 10, backgroundColor: tmpHour===h? colors.primary: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                <Text style={{ color: tmpHour===h? '#fff': colors.text, fontWeight: '700' }}>{h}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: colors.muted, marginBottom:6 }}>Minute</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
            {[0,15,30,45].map(m => (
              <Pressable key={m} onPress={() => setTmpMinute(m)} style={{ paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, borderRadius: 10, backgroundColor: tmpMinute===m? colors.primary: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                <Text style={{ color: tmpMinute===m? '#fff': colors.text, fontWeight: '700' }}>{String(m).padStart(2,'0')}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <Pressable onPress={() => setPickerVisible(false)} style={{ paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={commitPicker} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.primary, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

// Removed outdated static styles block; dynamic styles generated via styleFactory + useThemedStyles.

// Extra styles for time pills and picker
const extra = (colors) => ({
  timePill: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  timePillLabel: { color: colors.muted, marginBottom: 4 },
  timePillValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
