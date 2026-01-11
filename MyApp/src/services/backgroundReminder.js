import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import { ensureNotificationPermission } from './notifications';
import { loadPreferences, getPuzzleCounts } from '../storage/preferences';

const TASK_NAME = 'noScrollReminderTask';

function parseHHMM(s) {
  const m = s && s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return { h, min };
}
const toMin = (t) => (t ? t.h * 60 + t.min : null);
const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();
function inWindow(fromStr, toStr) {
  const f = toMin(parseHHMM(fromStr));
  const t = toMin(parseHHMM(toStr));
  if (f == null || t == null) return false;
  const cur = nowMin();
  return f <= t ? cur >= f && cur <= t : cur >= f || cur <= t;
}

async function shouldSend() {
  const { problemTarget = 5, fromTime, toTime } = await loadPreferences();
  if (!inWindow(fromTime, toTime)) return false;
  const counts = await getPuzzleCounts();
  const today = new Date().toISOString().substring(0, 10);
  const solved = counts[today] || 0;
  return solved < (Number(problemTarget) || 5);
}

// Define once at module scope so it works when app is not open
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const ok = await ensureNotificationPermission();
    if (ok && (await shouldSend())) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Don\'t scroll!',
          body: 'Solve some puzzles instead of scrolling.',
          sound: 'default',
        },
        trigger: null,
      });
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundReminder(minMinutes = 15) {
  try {
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: Math.max(15, minMinutes),
    });
    return true;
  } catch {
    return false;
  }
}
