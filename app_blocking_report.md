# App Blocking Architecture Report

This report outlines the architecture and workflows behind the application blocking mechanism, ensuring it persistently monitors and blocks restricted apps while respecting daily goals and device restarts.

## 1. Core State & Data Flow

The blocking state is primarily controlled by user preferences stored via React Native `AsyncStorage`, which are then synced to native Android `SharedPreferences` (named `ChessBlockerPrefs`) using the `PermissionModule.kt` bridge. 

The native Android components rely entirely on this `SharedPreferences` file to make immediate, synchronous decisions about whether to block an app without needing to wake up the React Native javascript engine.

Key state flags:
- `blocking_enabled` (Boolean): Determines if the blocking service should actively redirect the user.
- `today_date` (String, YYYY-MM-DD): The date the daily count was last tracked.
- `today_count` (Int): How many puzzles the user has solved today.

> [!CAUTION]
> If a user meets their daily goal, `blocking_enabled` is set to `false`. Without proper new-day checks, this flag would remain `false` forever.

## 2. Foreground Monitor Service

The `ForegroundMonitorService.kt` is an Android Foreground Service that runs continuously when monitoring is active.

1. **Polling Loop**: It uses a `Handler` to poll `UsageStatsManager` every 1,000 milliseconds to determine the name of the app currently in the foreground.
2. **Evaluation**:
   - If `blocking_enabled` is true, and the foreground app matches the restricted list, it fires an intent to bring the Chess Puzzles app to the front, effectively blocking access.
   - If `blocking_enabled` is false, it skips the check.
3. **Safety Net (Self-Healing)**: Within the polling loop, even if `blocking_enabled` is false, the service performs a date check (`SimpleDateFormat("yyyy-MM-dd")`). If it detects that the clock has rolled over to a new day since `today_date`, it autonomously resets the daily count to `0`, flips `blocking_enabled` back to `true`, and resumes blocking. This ensures that even if other system triggers fail, blocking is guaranteed to restart within 1 second of the user opening any app the following day.

## 3. Midnight Reset Workflow

To reset counts exactly at midnight, the app uses Android's `AlarmManager` to schedule a pending intent to `MidnightResetReceiver.kt`.

> [!WARNING]
> Android 12+ (API 31+) introduced severe restrictions on exact alarms, requiring explicit runtime permission (`SCHEDULE_EXACT_ALARM`). 

To handle modern Android restrictions:
1. The `scheduleMidnightAlarm` function calculates the millisecond difference until 12:00 AM of the next day.
2. It checks `AlarmManager.canScheduleExactAlarms()`.
3. If permitted, it uses `setExactAndAllowWhileIdle()` to guarantee a precise midnight reset.
4. If not permitted, it falls back to `setAndAllowWhileIdle()`, which instructs the OS to fire the alarm as close to midnight as system battery optimizations allow.
5. Upon firing, the `MidnightResetReceiver` resets the `today_count`, enables `blocking_enabled`, and re-starts the `ForegroundMonitorService`.

## 4. Device Reboot Restoration

When a device is restarted, any running foreground services and alarms are killed and cleared. The `BootReceiver.kt` is responsible for restoring the blocking workflow.

### Robust Initialization
The `BootReceiver` is hardened against various manufacturer and OS-level edge cases:
- **Direct Boot Awareness**: Configured with `android:directBootAware="true"` and listening for `LOCKED_BOOT_COMPLETED`, the receiver attempts to run as early in the boot cycle as possible.
- **CE Storage Lock Prevention**: Because Credential Encrypted (CE) storage is locked until the user unlocks their phone, reading `SharedPreferences` during `LOCKED_BOOT_COMPLETED` can crash the app on some devices. The `BootReceiver` wraps this read in a `try-catch`. If it fails, it simply waits for the standard `BOOT_COMPLETED` broadcast upon unlock.
- **OEM Action Support**: Many custom Android ROMs (like Xiaomi, ColorOS, HTC) suppress `BOOT_COMPLETED` and instead use custom intents like `android.intent.action.QUICKBOOT_POWERON`. The receiver's intent filter explicitly captures these to guarantee it runs across all device manufacturers.

### New-Day Detection on Boot
Historically, if a user finished their goal at night, `blocking_enabled` became `false`. If they rebooted their phone the next morning, a naive boot receiver would read `false` and do nothing.

The improved `BootReceiver`:
1. Retrieves the current date upon boot.
2. Compares it against `today_date`.
3. If it's a new day, it instantly overrides the old preference, sets `blocking_enabled` to `true`, and zeroes the `today_count`.
4. Reschedules the `MidnightResetReceiver` (as alarms are wiped during reboot).
5. Starts the `ForegroundMonitorService`.

## Summary

The app blocking architecture relies on **three overlapping mechanisms** to guarantee persistence:
1. `MidnightResetReceiver`: Triggers a clean transition at exactly midnight (or shortly after).
2. `BootReceiver`: Ensures all services and alarms are restored if the system shuts down.
3. `ForegroundMonitorService` (Safety Net): Continuously audits the date during its polling loop to self-heal the blocking state if either of the above mechanisms fail due to OS restrictions.
