# App Blocking Report

## Purpose
This codebase implements a chess-based app-blocking system. The product goal is to keep a user inside a puzzle loop whenever they open distracting apps, while still making onboarding and device permissions survivable across Android versions and OEM skins.

## Top-Level Flow
1. The app boots in [App.js](App.js) and decides whether to show onboarding or the main app based on the stored onboarding flag.
2. If the user has already onboarded, Android-specific monitoring is resumed immediately and the midnight reset alarm is re-scheduled.
3. Onboarding collects blocked apps, puzzle goals, and permissions required for usage detection, overlay display, and OEM popup behavior.
4. Once onboarding completes, the native foreground monitor starts and uses usage events to detect when a blocked app enters the foreground.
5. When a blocked app is detected, the app is brought back to the foreground and the user is pushed into the puzzle experience.
6. Daily puzzle progress is tracked so blocking can stop once the configured goal is reached.

## Startup And App Selection
- [index.js](index.js) registers the React Native root component and the background reminder no-op.
- [App.js](App.js) loads saved preferences, restores the chosen theme, and resumes blocking on Android when onboarding has already been completed.
- [App.js](App.js) stores the onboarding completion flag under `hasOnboarded` and exposes `completeOnboarding` through context.
- The app theme is pulled from stored preferences and injected into the navigation container so the whole UI stays consistent.

## Onboarding Flow
The onboarding flow lives in [src/screens/onboarding/OnboardingPager.jsx](src/screens/onboarding/OnboardingPager.jsx).

### Phase 1: Hook pages
- The first pages explain the problem, the chess-based solution, and the habit change the app is trying to create.
- These pages are purely motivational and do not request permissions.

### Phase 2: Setup
- The setup page uses [SettingsQuickSetup](src/components/SettingsQuickSetup.jsx) to choose which social apps should be blocked.
- The same screen stores the daily chess puzzle target that must be solved before blocking is released.
- Setup is persisted through `setBlocked` and `savePreferences`.

### Phase 3: Core permissions
- The permission page requests Usage Access so the app can detect the foreground app.
- It requests overlay permission so the puzzle UI can appear on top of blocked apps.
- This page is the primary gate for the core blocking loop.

### Phase 4: OEM/device-specific permissions
- The OEM page handles manufacturer-specific routing for background popup behavior.
- OnePlus-family devices are treated as a special path because some variants expose the permission through special app permissions.
- Generic devices route through App Info / Other permissions guidance when the system cannot expose a verifiable special-app-permission path.
- Battery optimization is handled here only on supported Android versions.

### Phase 5: Completion
- The final onboarding step starts blocking by syncing the selected configuration to native, starting the foreground service, and validating the current blocking state.
- If the environment cannot verify an OEM popup permission, the user is not trapped on the page.
- If the configured blocking state is inactive, onboarding completion is blocked to avoid crashing or entering an unusable state.

## Permission Model
### Usage Access
- Checked and requested from the onboarding permission page.
- Used by native and JS polling to determine when a blocked app is in the foreground.

### Overlay Permission
- Also requested from onboarding.
- Required so the app can present the puzzle/blocking UI over distracting apps.

### OEM popup permission
- OnePlus-family devices use a special-app-permission support probe when the OS exposes it.
- If the special-app-permission path is supported and the permission is missing, the onboarding page can block progression.
- If the OS does not expose that path, the app does not hard-block the user.
- Generic and Redmi-class devices are routed to the manufacturer settings or App Info page instead of being programmatically trapped on a permission check.

### Battery optimization
- The app checks battery optimization only where Android supports it.
- If battery optimization is already handled, onboarding does not show a success confirmation message.
- If it is still active, the user is prompted to switch the app to Unrestricted / Not optimized so background blocking can continue.

## Native Blocking Loop
The native enforcement path is centered in [android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/PermissionModule.kt](android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/PermissionModule.kt) and [android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/ForegroundMonitorService.kt](android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/ForegroundMonitorService.kt).

### PermissionModule responsibilities
- Requests and checks usage access.
- Requests and checks overlay permission.
- Opens OEM-specific settings screens for popup behavior.
- Synchronizes blocked app configuration, puzzle target, and daily puzzle counts into native shared preferences.
- Starts, stops, resumes, enables, and disables blocking.
- Schedules the midnight reset alarm.

### ForegroundMonitorService responsibilities
- Runs as a foreground service so the system is less likely to kill the monitoring process.
- Queries usage events on a short polling interval.
- Reads blocked app configuration and the current blocking state from shared preferences.
- If a blocked app enters the foreground, it brings the app back to the front.
- Stops blocking automatically when the daily puzzle goal has been reached.
- Exposes a notification action so the user can pause blocking manually.

## App State And Persistence
The persistent state lives in [src/storage/preferences.js](src/storage/preferences.js).

### Stored values
- Blocked app map.
- Daily puzzle target.
- Theme colors.
- Chess username and tactics rating.
- Toggle count for the blocked-app freeze behavior.
- Daily puzzle counts.

### Native sync points
- `syncBlockedList` keeps the native monitor aligned with the JS blocked-app map.
- `syncProblemTarget` stores the daily goal in native prefs.
- `syncTodayPuzzleCount` stores progress for the current day.
- `startMonitoring`, `stopMonitoring`, `enableBlocking`, and `disableBlocking` control the active blocking state.

## Midnight And Reboot Behavior
- [android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/MidnightResetReceiver.kt](android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/MidnightResetReceiver.kt) resets the daily count at midnight and re-enables blocking for a new day.
- [android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/BootReceiver.kt](android/app/src/main/java/com/jskarthik/noscrollscreentimechesspuzzles/BootReceiver.kt) restores the foreground monitor after device reboot when blocking was enabled before reboot.
- The alarm is rescheduled after each midnight reset so the daily loop remains stable.

## Settings And User Controls
The blocking controls live in [src/screens/main/SettingsScreen.jsx](src/screens/main/SettingsScreen.jsx).

- The user can inspect the current blocking status.
- Blocking can be paused or resumed from a toggle on Android.
- The app warns before pausing blocking so the user understands it will stop monitoring until re-enabled or until the next day.
- The blocked apps list is frozen after the configured number of untoggles has been used.
- The settings screen also provides theme controls, puzzle goal controls, and chess rating import.

## Puzzle And Fallback Experience
The blocking experience is not a dead-end screen. It leads into the puzzle UI that keeps the user engaged until they solve the configured goal.

- [src/components/BoardPanel.jsx](src/components/BoardPanel.jsx) wraps the chess board with like/share actions, solve-state banners, and feedback for correct or incorrect moves.
- [src/components/ChessBoard.jsx](src/components/ChessBoard.jsx) renders the board, handles move selection, legal moves, and latest-move highlighting.
- The latest move is shown with a neutral ring marker so it remains readable on both light and dark squares.
- Legal move hints and selected-square borders help the user understand the current board state.

## Navigation And Tabs
- [src/navigation/AppNavigator.jsx](src/navigation/AppNavigator.jsx) provides the main app tabs for puzzles, streak, and settings.
- [src/navigation/OnboardingNavigator.jsx](src/navigation/OnboardingNavigator.jsx) isolates onboarding from the main application flow.

## Background Reminder
- [src/services/backgroundReminder.js](src/services/backgroundReminder.js) is currently a noop registration shim.
- [index.js](index.js) still calls the registration function so the app remains compatible with the original startup structure without scheduling the removed reminder behavior.

## Important Behavioral Guarantees
- Blocking only starts after onboarding is complete and the configuration is synced.
- The app does not hard-block the user on OEM permission checks when the OS does not expose a verifiable special-app-permission path.
- The user can pause blocking from settings and the service notification.
- The daily goal can disable blocking after the required puzzle count is reached.
- Reboot and midnight transitions are handled so the monitoring loop keeps working across sessions.

## Recent UI/logic refinements captured in this codebase
- Chess pieces were restored to the previous FontAwesome icon set.
- Latest-move highlighting was changed from square fill to a neutral outline-based marker.
- Onboarding permission handling was hardened so uncheckable OEM permissions do not trap the user.
- OnePlus permission validation only uses a supported special-app-permission path.
- Generic devices use App Info / Other permissions routing for manual enablement instructions.
