import { NativeModules } from 'react-native';

const { PermissionModule } = NativeModules;

let lastTimestamp = Date.now();
let intervalId = null;

// Map our logical keys (facebook, instagram, etc.) to real Android package names.
const KEY_TO_PACKAGES = {
  facebook: ['com.facebook.katana', 'com.facebook.lite'],
  twitter: ['com.twitter.android', 'com.twitter.android.lite'],
  instagram: ['com.instagram.android'],
  youtube: ['com.google.android.youtube'],
  reddit: ['com.reddit.frontpage'],
  whatsapp: ['com.whatsapp'],
  snapchat: ['com.snapchat.android'],
  // Fallback mapping for keys we don't recognize will just use the key itself.
};

/**
 * Start polling Android UsageStats via the native PermissionModule.
 * blockedMap: { [logicalKey: string]: boolean }
 * onBlockTriggered: (packageName: string) => void
 */
export const startUsagePolling = (blockedMap, onBlockTriggered) => {
  if (intervalId) return;

  const blockedPackageList = [];
  Object.keys(blockedMap || {}).forEach((key) => {
    if (!blockedMap[key]) return;
    const pkgs = KEY_TO_PACKAGES[key] || [key];
    blockedPackageList.push(...pkgs);
  });

  intervalId = setInterval(async () => {
    try {
      if (!PermissionModule || typeof PermissionModule.getUsageEvents !== 'function') {
        return;
      }

      const events = await PermissionModule.getUsageEvents(lastTimestamp);

      if (events && events.length > 0) {
        // advance cursor to just after the last event we saw
        const latest = events[events.length - 1];
        if (latest && typeof latest.timestamp === 'number') {
          lastTimestamp = latest.timestamp + 1;
        } else {
          lastTimestamp = Date.now();
        }

        for (const event of events) {
          if (!event || !event.packageName) continue;

          if (blockedPackageList.includes(event.packageName)) {
            try {
              onBlockTriggered && onBlockTriggered(event.packageName);
            } catch (e) {
              // silently ignore
            }
          }
        }
      }
    } catch (e) {
      // silently ignore
    }
  }, 1000);
};

export const stopUsagePolling = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
