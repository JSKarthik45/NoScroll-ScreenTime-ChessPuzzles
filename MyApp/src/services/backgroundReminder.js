// Background reminder removed: no longer schedule background notifications for a "no-scroll" window.
// Keep a noop registration function so callers may safely call it without effect.
export async function registerBackgroundReminder(/* minMinutes = 15 */) {
  return false;
}
