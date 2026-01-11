import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { loadPreferences, getPuzzleCounts } from '../storage/preferences';

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,  
    shouldShowList: true,     
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;

  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }

  // Android: create a channel for notifications (required on Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return status === 'granted';
}

// --- No-scroll window reminder logic ---

function parseHHMM(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  h = Math.max(0, Math.min(23, h));
  min = Math.max(0, Math.min(59, min));
  return { h, min };
}

function minutesSinceMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function toMinutes(t) {
  return t ? t.h * 60 + t.min : null;
}

// Handles windows that may cross midnight
function isNowInWindow(fromStr, toStr, now = new Date()) {
  const from = parseHHMM(fromStr);
  const to = parseHHMM(toStr);
  if (!from || !to) return false;
  const f = toMinutes(from);
  const t = toMinutes(to);
  const cur = minutesSinceMidnight(now);
  if (f === null || t === null) return false;
  if (f <= t) {
    return cur >= f && cur <= t;
  } else {
    // crosses midnight: e.g., 22:00 -> 06:00
    return cur >= f || cur <= t;
  }
}

async function shouldSendReminder() {
  const prefs = await loadPreferences();
  const { problemTarget = 5, fromTime, toTime } = prefs;
  if (!isNowInWindow(fromTime, toTime)) return false;

  const counts = await getPuzzleCounts();
  const today = new Date().toISOString().substring(0, 10);
  const solved = counts[today] || 0;
  return solved < (Number(problemTarget) || 5);
}

// --- Daily notification at start of no-scroll window ---

export async function scheduleDailyNoScrollNotification() {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;

  const prefs = await loadPreferences();
  const { fromTime } = prefs;
  const parsed = parseHHMM(fromTime);
  if (!parsed) return null;

  const hour = parsed.h;
  const minute = parsed.min;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'No-scroll time',
      body: 'Time to solve puzzles instead of scrolling.',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      repeats: true,
    },
  });

  return id;
}

let reminderIntervalHandle = null;

export function startNoScrollReminder(intervalMs = 1 * 60 * 1000) {
  // Avoid duplicate intervals
  if (reminderIntervalHandle) return;
  reminderIntervalHandle = setInterval(async () => {
    try {
      const send = await shouldSendReminder();
      if (send) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Keep going!',
            body: 'Finish your daily puzzle goal.',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      }
    } catch {}
  }, intervalMs);
}

export function stopNoScrollReminder() {
  if (reminderIntervalHandle) {
    clearInterval(reminderIntervalHandle);
    reminderIntervalHandle = null;
  }
}
