import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useThemeColors, useThemedStyles } from '../theme/ThemeContext';
import { loadPreferences, savePreferences } from '../storage/preferences';

const styleFactory = (colors) => StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: colors.text },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timePill: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.primary,
  },
  timePillLabel: { color: colors.secondary, marginBottom: 4 },
  timePillValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingVertical: 3,
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
  helperText: { marginTop: 1, color: colors.muted },
});

export default function SettingsQuickSetup({ blocked, setBlocked, problemTarget, setProblemTarget }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(styleFactory);
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('from');
  const [tmpHour, setTmpHour] = useState(9);
  const [tmpMinute, setTmpMinute] = useState(0);
  const [tmpAmPm, setTmpAmPm] = useState('AM');

  useEffect(() => {
    (async () => {
      const pref = await loadPreferences();
      if (pref.fromTime) setFromTime(pref.fromTime);
      if (pref.toTime) setToTime(pref.toTime);
    })();
  }, []);

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

  const commitPicker = () => {
    const h24 = (tmpHour % 12) + (tmpAmPm === 'PM' ? 12 : 0);
    const mm = String(tmpMinute).padStart(2, '0');
    const value = `${String(h24).padStart(2, '0')}:${mm}`;
    if (pickerTarget === 'from') setFromTime(value);
    else setToTime(value);
    savePreferences({ problemTarget, fromTime: pickerTarget === 'from' ? value : fromTime, toTime: pickerTarget === 'to' ? value : toTime });
    setPickerVisible(false);
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>When do you end up scrolling the most?</Text>
      <View style={styles.card}>
        <View style={styles.timeRow}>
          <Pressable onPress={() => openPicker('from')} style={styles.timePill}>
            <Text style={styles.timePillLabel}>From</Text>
            <Text style={styles.timePillValue}>{formatTime(fromTime)}</Text>
          </Pressable>
          <Pressable onPress={() => openPicker('to')} style={styles.timePill}>
            <Text style={styles.timePillLabel}>To</Text>
            <Text style={styles.timePillValue}>{formatTime(toTime)}</Text>
          </Pressable>
        </View>
        <Text style={styles.helperText}>We’ll steer you back to puzzles during this window.</Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Daily puzzle goal</Text>
      <View style={styles.pillRow}>
        {[1, 3, 5, 10, 20].map(n => {
          const active = problemTarget === n;
          return (
            <Pressable key={n} onPress={() => setProblemTarget(n)} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helperText}>If you haven't hit your {problemTarget}-puzzle goal by no‑scroll time, we’ll nudge you to finish instead of scrolling.</Text>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center' }}>
          <View style={{ width:'86%', borderRadius:16, backgroundColor: colors.surface, padding:14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Select time</Text>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical:6 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                <Pressable key={h} onPress={() => setTmpHour(h)} style={{ paddingVertical:10, paddingHorizontal:12, marginRight:8, borderRadius:10, backgroundColor: tmpHour===h? colors.primary: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                  <Text style={{ color: tmpHour===h? '#fff': colors.text, fontWeight:'700' }}>{h}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={{ color: colors.muted, marginBottom:6 }}>Minute</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical:6 }}>
              {[0,15,30,45].map(m => (
                <Pressable key={m} onPress={() => setTmpMinute(m)} style={{ paddingVertical:10, paddingHorizontal:12, marginRight:8, borderRadius:10, backgroundColor: tmpMinute===m? colors.primary: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                  <Text style={{ color: tmpMinute===m? '#fff': colors.text, fontWeight:'700' }}>{String(m).padStart(2,'0')}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12 }}>
              <Pressable onPress={() => setPickerVisible(false)} style={{ paddingVertical:10, paddingHorizontal:14, marginRight:8 }}>
                <Text style={{ color: colors.muted, fontWeight:'600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={commitPicker} style={{ paddingVertical:10, paddingHorizontal:14, backgroundColor: colors.primary, borderRadius:10 }}>
                <Text style={{ color: '#fff', fontWeight:'800' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
